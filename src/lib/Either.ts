export type Either<T> = Left<T> | Right<T>;

class Left<T> {
    public readonly val: string;

    constructor(val: string) {
        this.val = val;
    }
}

export function left<T>(val: string): Left<T> {
    return new Left(val);
}

export function isLeft<T>(either: Either<T>): either is Left<T> {
    return either instanceof Left;
}

class Right<T> {
    public readonly val: T;

    constructor(val: T) {
        this.val = val;
    }
}

export function right<T>(val: T): Right<T> {
    return new Right(val);
}

export function isRight<T>(either: Either<T>): either is Right<T> {
    return either instanceof Right;
}

export function fromRight<T>(either: Either<T>): T {
    if (either instanceof Left) {
        throw new Error(either.val);
    }
    return either.val;
}

export function assertRight<T>(either: Either<T>, msg: string="Assertion error: "): void {
    if (either instanceof Left) {
        throw new Error(msg + ': ' + either.val);
    }
}