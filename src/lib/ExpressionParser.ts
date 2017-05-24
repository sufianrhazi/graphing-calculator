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

const parseCall: Parser.Parser<NodeCall> = Parser.fromGenerator<NodeReference|string|NodeExpr[]|undefined,NodeCall>(function *() {
    var reference = yield parseReference;
    yield token(Parser.str("("));
    var args = yield Parser.sepBy(token(Parser.str(',')), parseExpression);
    yield token(Parser.str(")"));
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

function surround<L,T,R>(left: Parser.Parser<L>, val: Parser.Parser<T>, right: Parser.Parser<R>): Parser.Parser<T> {
    return Parser.fromGenerator(function *() {
        yield left;
        var v = yield val;
        yield right;
        return v;
    });
}

interface OperatorDeclUnary {
    op: Parser.Parser<(value: NodeExpr) => NodeOperatorUnary>;
    fixity: "prefix" | "postfix";
}
interface OperatorDeclBinary {
    op: Parser.Parser<(left: NodeExpr, right: NodeExpr) => NodeOperatorBinary>;
    fixity: "infix";
    associativity: "left" | "right";
}

type OperatorDecl = OperatorDeclUnary|OperatorDeclBinary;
type OperatorDecls = OperatorDecl[];

function binop(associativity: "left" | "right", operator: string): OperatorDeclBinary {
    var opParser = Parser.map(token(Parser.str(operator)), (str: string) => (left: NodeExpr, right: NodeExpr): NodeOperatorBinary => {
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
        op: opParser,
        fixity: "infix",
        associativity: associativity,
    };
}

function unop(fixity: "prefix" | "postfix", operator: string): OperatorDeclUnary {
    var opParser = Parser.map(token(Parser.str(operator)), (str: string) => (val: NodeExpr): NodeOperatorUnary => {
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
        op: opParser,
        fixity: fixity,
    };
}

var operators: OperatorDecls = [
    unop("prefix", "-"),
    unop("prefix", "+"),
    binop("right", "^"),
    binop("left", "*"), binop("left", "/"),
    binop("left", "+"), binop("left", "-"),
    binop("left", "&&"),
    binop("left", "||"),
    binop("left", "<="), binop("left", "<"), binop("left", ">="), binop("left", ">"), binop("left", "=="), binop("left", "!=")
]

function buildExpressionParser<T>(operators: OperatorDecls, parseTermFactory: () => Parser.Parser<NodeExpr>): Parser.Parser<NodeExpr> {
    var parseTerm = parseTermFactory();
    var preOps: (Parser.Parser<(val: NodeExpr) => NodeOperatorUnary>)[] = [];
    var postOps: (Parser.Parser<(val: NodeExpr) => NodeOperatorUnary>)[] = [];
    var binOps: {
        precedence: number,
        associativity: "left" | "right",
        parser: Parser.Parser<(left: NodeExpr, right: NodeExpr) => NodeOperatorBinary>
    }[] = [];
    for (let i = 0; i < operators.length; ++i) {
        let precedence: number = operators.length - i;
        let operator = operators[i];
        switch (operator.fixity) {
        case "infix":
            binOps.push({ precedence, associativity: operator.associativity, parser: operator.op });
            break;
        case "postfix":
            postOps.push(operator.op);
            break;
        case "prefix":
            preOps.push(operator.op);
            break;
        }
    }

    var parseExprTerm = Parser.fromGenerator<NodeExpr|((val: NodeExpr) => NodeOperatorUnary)|null,NodeExpr>(function *() {
        var preFuncs: ((val: NodeExpr) => NodeOperatorUnary)[] = [];
        var postFuncs: ((val: NodeExpr) => NodeOperatorUnary)[] = [];
        for (let op of preOps) {
            var f: ((val: NodeExpr) => NodeOperatorUnary)|null = yield Parser.maybe(op);
            if (f !== null) {
                preFuncs.push(f);
            }
        }
        var result: NodeExpr = yield parseTerm;
        for (let op of postOps) {
            var f: ((val: NodeExpr) => NodeOperatorUnary)|null = yield Parser.maybe(op);
            if (f !== null) {
                postFuncs.push(f);
            }
        }
        for (let f of preFuncs) {
            result = f(result);
        }
        for (let f of postFuncs) {
            result = f(result);
        }
        return result;
    });

    // This uses the precedence climbing algorithm
    // See http://eli.thegreenplace.net/2012/08/02/parsing-expressions-by-precedence-climbing
    function parseExpressionPrecedence(minPrec: number): Parser.Parser<NodeExpr> {
        return Parser.fromGenerator<NodeExpr|((left: NodeExpr, right: NodeExpr) => NodeExpr)|null,NodeExpr>(function *() {
            var left: NodeExpr = yield parseExprTerm;
            while (true) {
                var action = null;
                var associativity: "left" | "right" | undefined;
                var precedence: number | undefined;
                for (var i = 0; i < binOps.length && action === null; ++i) {
                    var op = binOps[i];
                    if (op.precedence >= minPrec) {
                        action = yield Parser.maybe(op.parser);
                        associativity = op.associativity;
                        precedence = op.precedence;
                    }
                }
                if (action === null) { // if action is not null, associativity and precedence are both not undefined
                    return left;
                }
                var nextMinPrec: number;
                if (associativity === 'left') {
                    nextMinPrec = <number>precedence + 1;
                } else {
                    nextMinPrec = <number>precedence;
                }
                var right = yield parseExpressionPrecedence(nextMinPrec);
                left = action(left, right);
            }
        });
    }
    return parseExpressionPrecedence(0);
}

var parseExpression = buildExpressionParser(operators, (): Parser.Parser<NodeExpr> => {
    return Parser.fromGenerator(function *() {
        var result = yield Parser.maybe(surround(token(Parser.str("(")), parseExpression, token(Parser.str(")"))));
        if (result !== null) {
            return result;
        } else {
            return yield parseTerm;
        }
    });
})

export function parse(expression: string): NodeExpr {
    return Parser.runToEnd(parseExpression, expression);
}