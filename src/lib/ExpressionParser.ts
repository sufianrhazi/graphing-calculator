import * as Parser from 'parsinator';

var ows = Parser.regex(/\s*/);
var ws = Parser.regex(/\s+/);

function token<P>(p: Parser.Parser<P>): Parser.Parser<P> {
    return Parser.surround(ows, p, ows);
}
function keyword<P>(p: Parser.Parser<P>): Parser.Parser<P> {
    return Parser.surround(ows, p, ws);
}

export interface NodeNumber {
    type: "number";
    value: number;
};
export interface NodeReference {
    type: "reference";
    value: string;
}
export interface NodeCall {
    type: "call";
    value: {
        reference: NodeReference;
        args: NodeExpr[];
    };
}
export interface NodeFunction {
    type: "function";
    value: {
        reference: NodeReference;
        args: NodeReference[];
        body: NodeExpr;
        context: NodeExpr;
    }
}
export type Fixity = "prefix" | "postfix";
export interface NodeOperatorUnary {
    type: "unary";
    value: {
        op: string;
        fixity: Fixity;
        value: NodeExpr;
    }
}
export interface NodeOperatorBinary {
    type: "binary";
    value: {
        op: string;
        left: NodeExpr;
        right: NodeExpr;
    }
}
export interface NodeBinding {
    type: "binding";
    value: {
        reference: NodeReference,
        binding: NodeExpr,
        expression: NodeExpr,
    }
}
export interface NodeIf {
    type: "if";
    value: {
        cond: NodeExpr;
        then: NodeExpr;
        else: NodeExpr;
    }
}

export type NodeExpr
    = NodeOperatorBinary
    | NodeOperatorUnary
    | NodeCall
    | NodeReference
    | NodeNumber
    | NodeBinding
    | NodeFunction
    | NodeIf

const parseLiteral: Parser.Parser<NodeNumber> = Parser.fromGenerator(function *() {
    return yield Parser.map<string,NodeNumber>(
        Parser.regex(/(([1-9][0-9]*|0)?\.[0-9]*)|([1-9][0-9]*|0)/),
        (str) => {
            return {
                type: 'number',
                value: parseFloat(str)
            };
        }
    );
});

const parseReference: Parser.Parser<NodeReference> = Parser.fromGenerator(function *() {
    return yield Parser.map<string,NodeReference>(
        Parser.regex(/[a-zA-Z_][a-zA-Z0-9_]*/),
        (str) => {
            return {
                type: "reference",
                value: str
            };
        }
    );
});

const parseCall: Parser.Parser<NodeCall> = Parser.fromGenerator<NodeReference|NodeExpr[],NodeCall>(function *() {
    var reference = yield parseReference;
    var args = yield Parser.surround(
        token(Parser.str("(")),
        Parser.sepBy(token(Parser.str(',')), parseExpression),
        token(Parser.str(")"))
    );
    return {
        type: "call",
        value: {
            reference: reference,
            args: args,
        },
    } as NodeCall;
});

const parseTerm: Parser.Parser<NodeCall|NodeReference|NodeNumber> = Parser.choice<NodeCall|NodeReference|NodeNumber>([
    parseCall,
    parseReference,
    parseLiteral
]);


function binop(associativity: "left" | "right", operator: string): Parser.OperatorDeclBinary<NodeExpr> {
    var opParser = token(Parser.str(operator));
    var parser = Parser.map(opParser, (str: string) => (left: NodeExpr, right: NodeExpr): NodeOperatorBinary => {
        return {
            type: "binary",
            value: {
                op: operator,
                left: left,
                right: right,
            }
        };
    });
    return {
        parser: parser,
        fixity: "infix",
        associativity: associativity,
    };
}

function unop(fixity: "prefix" | "postfix", operator: string): Parser.OperatorDeclUnary<NodeExpr> {
    var opParser = token(Parser.str(operator));
    var parser = Parser.map(opParser, (str: string) => (val: NodeExpr): NodeOperatorUnary => {
        return {
            type: "unary",
            value: {
                op: operator,
                fixity: fixity,
                value: val,
            }
        };
    });
    return {
        parser: parser,
        fixity: fixity,
    };
}
var parseExpression: Parser.Parser<NodeExpr> = Parser.buildExpressionParser<NodeExpr>([
    unop("prefix", "-"),
    unop("prefix", "+"),
    binop("right", "^"),
    binop("left", "*"),
    binop("left", "/"),
    binop("left", "+"),
    binop("left", "-"),
    binop("left", "&&"),
    binop("left", "||"),
    binop("left", "<="), binop("left", "<"), binop("left", ">="), binop("left", ">"), binop("left", "=="), binop("left", "!=")
], () => Parser.choice([
    parseBinding,
    parseFunction,
    parseIf,
    Parser.surround(token(Parser.str("(")), parseExpression, token(Parser.str(")"))),
    parseTerm
]));
var parseIf: Parser.Parser<NodeIf> = Parser.fromGenerator<string|NodeExpr,NodeIf>(function *() {
    yield keyword(Parser.str("if"));
    var cond: NodeExpr = yield parseExpression;
    yield keyword(Parser.str("then"));
    var thenEx: NodeExpr = yield parseExpression;
    yield keyword(Parser.str("else"));
    var elseEx: NodeExpr = yield parseExpression;
    return {
        type: "if",
        value: {
            cond: cond,
            then: thenEx,
            else: elseEx,
        }
    } as NodeIf;
});
var parseBinding: Parser.Parser<NodeBinding> = Parser.fromGenerator<string|NodeReference|NodeExpr,NodeBinding>(function *() {
    yield keyword(Parser.str("let"));
    var reference = yield parseReference;
    yield token(Parser.str("="));
    var value = yield parseExpression;
    yield keyword(Parser.str("in"));
    var expr = yield parseExpression;
    return {
        type: "binding",
        value: {
            reference: reference,
            binding: value,
            expression: expr, 
        }
    } as NodeBinding;
});

var parseFunction: Parser.Parser<NodeFunction> = Parser.fromGenerator<string|NodeReference|NodeReference[]|NodeExpr,NodeFunction>(function *() {
    yield keyword(Parser.str("let"));
    var reference: NodeReference = yield parseReference;
    var args: NodeReference[] = yield Parser.surround(
        token(Parser.str("(")),
        Parser.sepBy(token(Parser.str(',')), parseReference),
        token(Parser.str(")"))
    );
    yield token(Parser.str("="));
    var body: NodeExpr = yield parseExpression;
    yield keyword(Parser.str("in"));
    var context: NodeExpr = yield parseExpression;
    return {
        type: "function",
        value: {
            reference: reference,
            args: args,
            body: body,
            context: context, 
        }
    } as NodeFunction;
});

export function parse(expression: string): NodeExpr {
    return Parser.runToEnd(parseExpression, expression);
}

interface ScopeReference {
    reference: string;
}
export function compileExpr(expression: NodeExpr, scopes: ScopeReference[]): string {
    switch (expression.type) {
        case "number": {
            return expression.value.toString();
        }
        case "binary": {
            let left = compileExpr(expression.value.left, scopes);
            let right = compileExpr(expression.value.right, scopes);
            switch (expression.value.op) {
                case '*':
                case '/':
                case '+':
                case '-':
                case '&&':
                case '||':
                case '<=':
                case '<':
                case '>=':
                case '>':
                    return `(${left} ${expression.value.op} ${right})`;
                case '==':
                    return `(${left} === ${right})`;
                case '!=':
                    return `(${left} !== ${right})`;
                case '^':
                    return `Math.pow(${left}, ${right})`;
                default:
                    throw new Error(`Unknown operator: ${expression.value.op}`);
            }
        }
        case "unary": {
            let val = compileExpr(expression.value.value, scopes);
            return `(-${val})`;
        }
        case "call": {
            let ref = compileExpr(expression.value.reference, scopes);
            let args = expression.value.args.map((arg) => compileExpr(arg, scopes));
            return `${ref}(${args.join(', ')})`;
        }
        case "reference": {
            if (['x', 'y', 't'].indexOf(expression.value) !== -1) {
                return expression.value;
            } else if (expression.value in Math && typeof (Math as any)[expression.value] === 'function') {
                return 'Math.' + expression.value;
            } else if (expression.value === 'pi') {
                return 'Math.PI';
            } else if (expression.value === 'e') {
                return 'Math.E';
            } else if (expression.value === 'rand') {
                return 'Math.random';
            } else {
                for (let scope of scopes) {
                    if (scope.reference === expression.value) {
                        return expression.value;
                    }
                }
                throw new Error(`ReferenceError: reference variable ${expression.value} does not exist`);
            }
        }
        case "binding": {
            var reference = expression.value.reference.value;
            var binding = expression.value.binding;
            var evaluation = expression.value.expression;
            var newScope = scopes.concat([{ reference }]);
            return `(function (${reference}) { return ${compileExpr(evaluation, newScope)}; })(${compileExpr(binding, scopes)})`;
        }
        case "function": {
            var reference: string = expression.value.reference.value;
            var args: string[] = expression.value.args.map(arg => arg.value);
            var context: NodeExpr = expression.value.context;
            var contextScope: ScopeReference[] = scopes.concat([{ reference: reference }]);
            var body: NodeExpr = expression.value.body;
            var bodyScope: ScopeReference[] = contextScope.concat(args.map(arg => ({ reference: arg })));
            return `(function (${reference}) { return ${compileExpr(context, contextScope)}; })(function (${args.join(", ")}) { return ${compileExpr(body, bodyScope)}; })`;
        }
        case "if": {
            return `(${compileExpr(expression.value.cond, scopes)} ? ${compileExpr(expression.value.then, scopes)} : ${compileExpr(expression.value.else, scopes)})`;
        }
    }
};

export function compile(expression: NodeExpr): (x: number, y: number, t: number) => number {
    var func = new Function('x', 'y', 't', `return ${compileExpr(expression, [])};`);
    return function (x: number, y: number, t: number) {
        return func(x, y, t) as number;
    };
}