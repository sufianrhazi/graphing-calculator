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

interface UnaryOperatorDecl {
    op: Parser.Parser<(value: NodeExpr) => NodeOperatorUnary>;
    repr: string,
    fixity: "prefix" | "postfix";
}
interface BinaryOperatorDecl {
    op: Parser.Parser<(left: NodeExpr, right: NodeExpr) => NodeOperatorBinary>;
    repr: string,
    fixity: "infix";
    associativity: "left" | "right";
}

type OperatorDecl = (UnaryOperatorDecl|BinaryOperatorDecl)[][];

function binop(associativity: "left" | "right", operator: string): BinaryOperatorDecl {
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
        repr: operator,
        fixity: "infix",
        associativity: associativity,
    };
}

function unop(fixity: "prefix" | "postfix", operator: string): UnaryOperatorDecl {
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
        repr: operator,
        fixity: fixity,
    };
}

var operators: OperatorDecl = [
    [unop("prefix", "-"), unop("prefix", "+")],
    [binop("right", "^")],
    [binop("left", "*"), binop("left", "/")],
    [binop("left", "+"), binop("left", "-")],
    [binop("left", "&&")],
    [binop("left", "||")],
    [binop("left", "<="), binop("left", "<"), binop("left", ">="), binop("left", ">"), binop("left", "=="), binop("left", "!=")],
]

function buildExpressionParser<T>(operators: OperatorDecl, parseTermFactory: () => Parser.Parser<NodeExpr>): Parser.Parser<NodeExpr> {
    var parseTerm = parseTermFactory();
    var preOps: (Parser.Parser<(val: NodeExpr) => NodeOperatorUnary>)[] = [];
    var postOps: (Parser.Parser<(val: NodeExpr) => NodeOperatorUnary>)[] = [];
    var binOps: {
        repr: string,
        precedence: number,
        associativity: "left" | "right",
        parser: Parser.Parser<(left: NodeExpr, right: NodeExpr) => NodeOperatorBinary>
    }[] = [];
    for (let i = 0; i < operators.length; ++i) {
        let precedence: number = operators.length - i;
        for (let j = 0; j < operators[i].length; ++j) {
            let operator = operators[i][j];
            switch (operator.fixity) {
            case "infix":
                binOps.push({ repr: operator.repr, precedence, associativity: operator.associativity, parser: operator.op });
                break;
            case "postfix":
                postOps.push(operator.op);
                break;
            case "prefix":
                preOps.push(operator.op);
                break;
            }
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

    // This uses an adapted (for parser combinators) precedence climbing algorithm
    // See http://eli.thegreenplace.net/2012/08/02/parsing-expressions-by-precedence-climbing
    function parseExpressionPrecedence(minPrec: number): Parser.Parser<NodeExpr> {
        return Parser.fromGenerator<NodeExpr|((left: NodeExpr, right: NodeExpr) => NodeExpr)|null|undefined,NodeExpr>(function *() {
            yield Parser.debugTrace((str) => console.log(`Looking for term\n${str}`));
            var left: NodeExpr = yield parseExprTerm;
            while (true) {
                var action, associativity, precedence;
                Inner:
                for (var op of binOps) {
                    if (op.precedence >= minPrec) {
                        console.log(`Looking at ${op.repr} prec=${op.precedence} assoc=${op.associativity}`);
                        yield Parser.debugTrace((str) => console.log(str));
                        action = yield Parser.maybe(op.parser);
                        if (action !== null) {
                            console.log(`Got ${op.repr}`);
                            associativity = op.associativity;
                            precedence = op.precedence;
                            break Inner;
                        }
                    }
                }
                if (action === null || associativity === undefined || precedence === undefined) {
                    return left;
                }
                var nextMinPrec;
                if (associativity === 'left') {
                    nextMinPrec = precedence + 1;
                } else {
                    nextMinPrec = precedence;
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