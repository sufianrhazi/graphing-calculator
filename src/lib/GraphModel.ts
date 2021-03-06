import { Observable, Observer, ObserverCallback } from "./Observer";
import { Either, left, right, assertRight } from "./Either";
import { parse, compile } from "./ExpressionParser";

interface GraphModelData {
    min: number;
    max: number;
    func: string;
    time: number;
}

export class GraphModel implements Observable<string> {
    private min: number;
    private max: number;
    private func: (x: number, y: number, t: number) => number;
    private time: number;
    private isRunning: boolean;
    private isPaused: boolean;
    private observer: Observer<string>;

    constructor(properties: GraphModelData) {
        this.observer = new Observer();
        assertRight(this.setMin(properties.min), 'Invalid min');
        assertRight(this.setMax(properties.max), 'Invalid max');
        assertRight(this.setFunc(properties.func), 'Invalid func');
        assertRight(this.setTime(properties.time), 'Invalid time');
        this.isRunning = false;
        this.isPaused = false;
    }

    public getIsRunning(): boolean {
        return this.isRunning;
    }

    public getIsPaused(): boolean {
        return this.isPaused;
    }

    public getMin(): number {
        return this.min;
    }

    public setMin(min: number): Either<undefined> {
        if (isNaN(min)) return left('Not a number');
        if (min < -1000 || min > 1000) return left('Range must be between [-1000, 1000]');
        this.min = min;
        this.observer.dispatch('min');
        this.observer.dispatch('any');
        return right(undefined);
    }

    public getMax(): number {
        return this.max;
    }

    public setMax(max: number): Either<undefined> {
        if (isNaN(max)) return left('Not a number');
        if (max < -1000 || max > 1000) return left('Range must be between [-1000, 1000]');
        this.max = max;
        this.observer.dispatch('max');
        this.observer.dispatch('any');
        return right(undefined);
    }

    public getStep(): number {
        return (this.max - this.min) / 50;
    }

    public getFunc(): (x: number, y: number, z: number) => number {
        return this.func;
    }

    public setFunc(func: string): Either<undefined> {
        try {
            var parsed = parse(func);
            var compiled = compile(parsed);
        } catch (e) {
            return left(e.message);
        }
        this.func = compiled; // TODO: parse into an evaluatable expression
        this.observer.dispatch('func');
        this.observer.dispatch('any');
        return right(undefined);
    }

    public getTime(): number {
        return this.time;
    }

    public setTime(time: number): Either<undefined> {
        if (isNaN(time)) return left('Not a number');
        if (time < 0 || time > 600) return left('Time must be between [0, 600]');
        this.time = time
        this.observer.dispatch('time');
        this.observer.dispatch('any');
        return right(undefined);
    }

    public listen(f: ObserverCallback<string>) {
        this.observer.listen(f);
    }

    public unlisten(f: ObserverCallback<string>) {
        this.observer.unlisten(f);
    }

    public start(): Either<undefined> {
        if (this.isRunning && !this.isPaused) return left('Running already');
        if (!this.isRunning) {
            this.isRunning = true;
            this.observer.dispatch('running');
        }
        if (this.isPaused) {
            this.isPaused = false;
            this.observer.dispatch('paused');
        }
        this.observer.dispatch('any');
        return right(undefined);
    }

    public pause(): Either<undefined> {
        if (!this.isRunning) return left('Cannot pause when stopped');
        this.isPaused = !this.isPaused;
        this.observer.dispatch('paused');
        this.observer.dispatch('any');
        return right(undefined);
    }

    public stop(): Either<undefined> {
        if (!this.isRunning) return left('Stopped already');
        if (this.isRunning) {
            this.isRunning = false;
            this.observer.dispatch('running');
        }
        if (this.isPaused) {
            this.isPaused = false;
            this.observer.dispatch('paused');
        }
        this.observer.dispatch('any');
        return right(undefined);
    }
}