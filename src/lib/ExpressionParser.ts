import * as Parser from 'parsinator';

var ows = Parser.regex(/\s*/);
var ws = Parser.regex(/\s+/);

function token<P>(p: Parser.Parser<P>): Parser.Parser<P> {
    return Parser.fromGenerator<string|P,P>(function *() {
        yield ows;
        var value = yield p;
        yield ows;
        return value;
    });
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
export type NodeExpr
    = NodeOperatorBinary
    | NodeOperatorUnary
    | NodeCall
    | NodeReference
    | NodeNumber

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
    Parser.surround(token(Parser.str("(")), parseExpression, token(Parser.str(")"))),
    parseTerm
]));

export function parse(expression: string): NodeExpr {
    return Parser.runToEnd(parseExpression, expression);
}

function compileExpr(expression: NodeExpr): string {
    switch (expression.type) {
        case "number": {
            return expression.value.toString();
        }
        case "binary": {
            let left = compileExpr(expression.value.left);
            let right = compileExpr(expression.value.right);
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
            let val = compileExpr(expression.value.value);
            return `(-${val})`;
        }
        case "call": {
            let ref = compileExpr(expression.value.reference);
            let args = expression.value.args.map((arg) => compileExpr(arg));
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
                throw new Error(`ReferenceError: reference variable ${expression.value} does not exist`);
            }
        }
    }
};

export function compile(expression: NodeExpr): (x: number, y: number, t: number) => number {
    var func = new Function('x', 'y', 't', `return ${compileExpr(expression)};`);
    return function (x: number, y: number, t: number) {
        return func(x, y, t) as number;
    };
}