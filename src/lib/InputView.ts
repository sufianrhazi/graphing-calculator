import { qs, qsa, getOne, on } from './SimpleDom';
import { InputViewModel } from "./InputViewModel";
import { Either, left, right, isLeft, isRight } from "./Either";

export class InputView {
    private el: Element;
    private model: InputViewModel;
    private els: {
        min: HTMLInputElement;
        max: HTMLInputElement;
        func: HTMLTextAreaElement;
        time: HTMLInputElement;
        timeRepr: HTMLElement;
        start: HTMLButtonElement;
        pause: HTMLButtonElement;
        stop: HTMLButtonElement;
        errors: HTMLElement;
    };

    constructor(model: InputViewModel, el: Element) {
        this.el = el;
        this.model = model;
        this.els = {
            min: getOne(this.el, '[name="min"]', HTMLInputElement),
            max: getOne(this.el, '[name="max"]', HTMLInputElement),
            func: getOne(this.el, '[name="func"]', HTMLTextAreaElement),
            time: getOne(this.el, '[name="time"]', HTMLInputElement),
            timeRepr: getOne(this.el, '[data-time-value]', HTMLElement),
            start: getOne(this.el, '[name="start"]', HTMLButtonElement),
            pause: getOne(this.el, '[name="pause"]', HTMLButtonElement),
            stop: getOne(this.el, '[name="stop"]', HTMLButtonElement),
            errors: getOne(this.el, '[data-errors]', HTMLElement),
        };
        on(this.el, 'change', 'input[name="min"]', e => this.onMinChange());
        on(this.el, 'change', 'input[name="max"]', e => this.onMaxChange());
        on(this.el, 'change', 'input[name="func"]', e => this.onFuncChange());
        on(this.el, 'change', 'input[name="time"]', e => this.onTimeChange());
        on(this.el, 'click', 'button[name="start"]', e => this.onStart());
        on(this.el, 'click', 'button[name="pause"]', e => this.onPause());
        on(this.el, 'click', 'button[name="stop"]', e => this.onStop());
        this.model.listen((kind: "any") => {
            this.update();
        });
        this.update();
    }

    public update(): void {
        this.els.start.disabled = this.model.getIsRunning() && !this.model.getIsPaused();
        this.els.pause.disabled = !this.model.getIsRunning();
        this.els.stop.disabled  = !this.model.getIsRunning();
        this.els.time.disabled  = this.model.getIsRunning();
        this.els.timeRepr.textContent = this.model.getTime().toFixed(2);
    }

    public setError(key: string, val: string, inputEl: Element): void {
        var label = document.createElement('label');
        label.setAttribute('data-error', key);
        label.textContent = val;
        if (inputEl && inputEl.id) {
            label.setAttribute('for', inputEl.id);
        }
        this.els.errors.appendChild(label);
    }

    public clearError(key: string): void {
        qsa(this.els.errors, '[data-error="' + key + '"]').forEach(function (el) {
            if (el && el.parentNode) {
                el.parentNode.removeChild(el);
            }
        });
    }

    public onMinChange(): void {
        var result = this.model.setMin(parseFloat(this.els.min.value));
        if (isLeft(result)) {
            this.setError('min', result.val, this.els.min);
        } else {
            this.clearError('min');
        }
    }

    public onMaxChange(): void {
        var result = this.model.setMax(parseFloat(this.els.max.value));
        if (isLeft(result)) {
            this.setError('max', result.val, this.els.max);
        } else {
            this.clearError('max');
        }
    }

    public onFuncChange(): void {
        var result = this.model.setFunc(this.els.func.value);
        if (isLeft(result)) {
            this.setError('func', result.val, this.els.func);
        } else {
            this.clearError('func');
        }
    }

    public onTimeChange(): void {
        var result = this.model.setTime(parseInt(this.els.time.value, 10));
        if (isLeft(result)) {
            this.setError('time', result.val, this.els.time);
        } else {
            this.clearError('time');
        }
    }

    public onStart(): void {
        var result = this.model.start();
        if (isLeft(result)) {
            this.setError('play', result.val, this.els.start);
        } else {
            this.clearError('play');
        }
    }

    public onPause(): void {
        var result = this.model.pause();
        if (isLeft(result)) {
            this.setError('play', result.val, this.els.pause);
        } else {
            this.clearError('play');
        }
    }

    public onStop(): void {
        var result = this.model.stop();
        if (isLeft(result)) {
            this.setError('play', result.val, this.els.stop);
        } else {
            this.clearError('play');
        }
    }
}