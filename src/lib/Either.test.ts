import { Either, left, isLeft, right, isRight, assertRight, fromRight, runIterator } from "./Either";
import { test, assert } from "../testrunner"

test("left is left", function () {
    assert(isLeft(left("Error message")));
});

test("left is not right", function () {
    assert(!isRight(left("Error message")));
});

test("right is right", function () {
    assert(isRight(right(null)));
});

test("right is not left", function () {
    assert(!isLeft(right(null)));
});

test("left holds error messages", function () {
    var l = left("Error message");
    assert(l.val === "Error message");
});

test("right holds values", function () {
    var val = {};
    var r = right(val);
    assert(r.val === val);
});

test("fromRight produces value", function () {
    var val = {};
    var r = right(val);
    assert(val === fromRight(r));
});

test("fromRight throws with left", function () {
    var thrown = false;
    try {
        fromRight(left("nope"));
    } catch (e) {
        thrown = true;
    }
    assert(thrown);
});

test("assertRight throws with left", function () {
    var thrown = false;
    try {
        assertRight(left("nope"), "Custom message");
    } catch (e) {
        thrown = true;
        assert(e.message === "Custom message: nope");
    }
    assert(thrown);
});

test("runIterator happy path", function () {
    var result = runIterator(function* () {
        var a = yield right("a");
        var b = yield right("b");
        var c = yield right("c");
        return "abc";
    });
    assert(fromRight(result) === "abc");
});

test("runIterator short-circuits and cleans up after itself", function () {
    var accumulator: string[] = [];
    var result = runIterator(function* () {
        try {
            accumulator.push('init');
            var a = yield right("a");
            accumulator.push('after-a');
            var b = yield left("An error");
            accumulator.push('after-b');
            var c = yield right("c");
        } finally {
            accumulator.push('finally');
        }
    });
    assert(isLeft(result), 'wut');
    assert(result.val === "An error", 'a');
    assert(accumulator.length === 3, 'aa');
    assert(accumulator[0] === 'init', 'b');
    assert(accumulator[1] === 'after-a', 'c');
    assert(accumulator[2] === 'finally', 'd');
});