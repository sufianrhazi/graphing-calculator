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
        op: "-";
        fixity: Fixity;
        value: NodeExpr;
    }
}
export type BinaryOp = "^" | "*" | "/" | "+" | "-" | ">=" | ">" | "<=" | "<" | "==" | "!=";
export interface NodeOperatorBinary {
    type: "binary";
    value: {
        op: BinaryOp;
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


// const parsePrefixOperator: Parser.Parser<NodeOperatorUnary> = Parser.fromGenerator<string|NodeExpr|undefined,NodeOperatorUnary>(function *() {
//     yield token(Parser.str("-"));
//     var value = yield parseExpression;
//     return {
//         type: "unary",
//         value: {
//             op: "-",
//             fixity: "prefix",
//             value: value,
//         },
//     } as NodeOperatorUnary;
// });

// function parseBinaryOpR(firstTerm: NodeExpr): Parser.Parser<NodeOperatorBinary> {
//     return Parser.choice([
//         Parser.str("^")
//     ].map((opParser) => {
//         return Parser.fromGenerator<NodeExpr|string,NodeOperatorBinary>(function *() {
//             var op: BinaryOp = yield token(opParser);
//             // right associative: a ^ b ^ c -> a ^ (b ^ c)
//             var secondTerm = yield parseExpression;
//             return {
//                 type: "binary",
//                 value: {
//                     op: op,
//                     left: firstTerm,
//                     right: secondTerm,
//                 },
//             } as NodeOperatorBinary;
//         });
//     }));
// }

// function parseBinaryOpL(firstTerm: NodeExpr): Parser.Parser<NodeOperatorBinary> {
//     return Parser.choice([
//         Parser.str("*"),
//         Parser.str("/"),
//         Parser.str("+"),
//         Parser.str("-"),
//         Parser.str(">="),
//         Parser.str(">"),
//         Parser.str("<="),
//         Parser.str("<"),
//         Parser.str("=="),
//         Parser.str("!="),
//     ].map((opParser) => {
//         return Parser.fromGenerator<NodeExpr|string,NodeOperatorBinary>(function *() {
//             var op: BinaryOp = yield token(opParser);
//             // left associative: a / b / c -> (a / b) / c
//             var secondTerm = yield parseExpressionTerm;
//             var node: NodeOperatorBinary = {
//                 type: "binary",
//                 value: {
//                     op: op,
//                     left: firstTerm,
//                     right: secondTerm,
//                 },
//             };
//             var leftExpr = yield Parser.maybe(Parser.choice([
//                 parseBinaryOpL(node),
//                 parseBinaryOpR(node)
//             ]));
//             if (leftExpr === null) {
//                 return node;
//             } else {
//                 return leftExpr;
//             }
//         });
//     }));
// }

// //     a + b  +     c * d  *  e ^  f ^ g   * h  * i  + j  + k
// // ((((a + b) + ((((c * d) * (e ^ (f ^ g)) * h) * i) + j) + k)
// function parseBinaryOp(firstTerm: NodeExpr): Parser.Parser<NodeOperatorBinary> {
//     return Parser.choice([
//         parseBinaryOpR(firstTerm),
//         parseBinaryOpL(firstTerm)
//     ]);
// }

const parseTerm: Parser.Parser<NodeCall|NodeReference|NodeNumber> = Parser.choice<NodeCall|NodeReference|NodeNumber>([
    parseCall,
    parseReference,
    parseLiteral
]);

const parseExpressionTerm: Parser.Parser<NodeExpr> = Parser.fromGenerator(function *() {
    var parenthized = yield Parser.maybe(surround(
        token(Parser.str("(")),
        parseExpression,
        token(Parser.str(")"))
    ));
    if (parenthized !== null) {
        return parenthized;
    }
    var opFunc = yield Parser.maybe(parseUnaryOp);
    if (opFunc === null) {
        return yield parseTerm;
    }
    var term = yield parseExpressionTerm;
    return opFunc(term);
});

function surround<L,T,R>(left: Parser.Parser<L>, val: Parser.Parser<T>, right: Parser.Parser<R>): Parser.Parser<T> {
    return Parser.fromGenerator(function *() {
        yield left;
        var v = yield val;
        yield right;
        return v;
    });
}

// const parseExpression: Parser.Parser<NodeExpr> = Parser.fromGenerator<NodeExpr|null,NodeExpr>(function *() {
//     var parenthized: NodeExpr|null = yield Parser.maybe(surround(
//         token(Parser.str("(")),
//         parseExpression,
//         token(Parser.str(")"))
//     ));
//     if (parenthized !== null) {
//         return parenthized;
//     }
//     var term: NodeExprTerm = yield parseExpressionTerm;
//     var binaryOp: NodeOperatorBinary|null = yield Parser.maybe(parseBinaryOp(term));
//     if (binaryOp !== null) {
//         return binaryOp;
//     } else {
//         return term;
//     }
// });

var parseUnaryOp: Parser.Parser<(val: NodeExpr) => NodeOperatorUnary> = Parser.map(token(Parser.str("-")), (op: string) => {
    return (value: NodeExpr): NodeOperatorUnary => {
        return {
            type: "unary",
            value: {
                op: "-",
                fixity: "prefix",
                value: value,
            }
        }
    }
});

var parseBinaryOpL: Parser.Parser<(left: NodeExpr, right: NodeExpr) => NodeOperatorBinary> = Parser.map(token(Parser.choice([
        Parser.str("*"),
        Parser.str("/"),
        Parser.str("+"),
        Parser.str("-"),
        Parser.str(">="),
        Parser.str(">"),
        Parser.str("<="),
        Parser.str("<"),
        Parser.str("=="),
        Parser.str("!=")
])), (op: BinaryOp) => {
    return (left: NodeExpr, right: NodeExpr): NodeOperatorBinary => {
        return {
            type: "binary",
            value: {
                op: op,
                left: left,
                right: right 
            }
        }
    }
});

var parseBinaryOpR: Parser.Parser<(left: NodeExpr, right: NodeExpr) => NodeOperatorBinary> = Parser.map(token(Parser.choice([
        Parser.str("^")
])), (op: BinaryOp) => {
    return (left: NodeExpr, right: NodeExpr): NodeOperatorBinary => {
        return {
            type: "binary",
            value: {
                op: op,
                left: left,
                right: right 
            }
        }
    }
});

function parseExpressionL(x: NodeExpr): Parser.Parser<NodeExpr> {
    return Parser.fromGenerator(function *() {
        var fn = yield parseBinaryOpL;
        var y = yield parseExpressionTerm;
        var expr = fn(x, y);
        var nextExpr = yield Parser.maybe(parseExpressionL(expr));
        if (nextExpr !== null) {
            return nextExpr;
        } else {
            return expr;
        }
    });
}

function parseExpressionR(x: NodeExpr): Parser.Parser<NodeExpr> {
    return Parser.fromGenerator(function *() {
        var fn = yield parseBinaryOpR;
        var y = yield Parser.fromGenerator(function *() {
            var z = yield parseExpressionTerm;
            var nextExpr = yield Parser.maybe(parseExpressionR(z));
            if (nextExpr !== null) {
                return nextExpr;
            } else {
                return z;
            }
        });
        var expr = fn(x, y);
        return expr;
    });
}

var parseExpression: Parser.Parser<NodeExpr> = Parser.fromGenerator(function *() {
    var term = yield parseExpressionTerm;
    var expr = yield Parser.maybe(Parser.choice([
        parseExpressionR(term),
        parseExpressionL(term),
    ]));
    if (expr !== null) {
        return expr;
    } else {
        return term;
    }
});

export function parse(expression: string): NodeExpr {
    return Parser.runToEnd(parseExpression, expression);
}