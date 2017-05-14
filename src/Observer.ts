export type ObserverCallback<T> = (val: T) => void;

export interface Observable<T> {
    listen(f: ObserverCallback<T>): void;
    unlisten(f: ObserverCallback<T>): void;
}

export class Observer<T> implements Observable<T> {
    private observers: ObserverCallback<T>[];

    constructor() {
        this.observers = [];
    }
    
    public listen(f: ObserverCallback<T>): void {
        this.observers.push(f);
    }

    public unlisten(f: ObserverCallback<T>): void {
        this.observers = this.observers.filter(g => f !== g);
    }

    public dispatch(data: T): void {
        this.observers.forEach(f => f(data));
    }
}