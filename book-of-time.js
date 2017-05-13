function qs(root, selector) {
    return root.querySelector(selector);
}

function qsa(root, selector) {
    return Array.from(root.querySelectorAll(selector));
}

function on(el, name, selector, handler, isCapture) {
    if (isCapture === undefined) {
        isCapture = false;
    }
    var eventHandler = null;
    var off = function () {
        if (eventHandler !== null) {
            el.removeEventListener(name, eventHandler, isCapture);
            eventHandler = null;
        }
    }
    eventHandler = function (event) {
        var subEl = qsa(event.currentTarget, selector).find(function (contender) {
            return contender === event.target;
        });
        if (subEl !== undefined) {
            handler(event, subEl);
        }
    }
    el.addEventListener(name, eventHandler, isCapture);
    return off;
}

function getProp(obj, name) {
    if (!(name in obj)) {
        throw new Error('FATAL: No property ' + name + ' defined in obj ' + JSON.stringify(obj));
    }
    return obj[name];
}

function ObserverFactory() {
    this._observers = [];
}
Object.assign(ObserverFactory.prototype, {
    listen: function (f) {
        this._observers.push(f);
    },
    unlisten: function (f) {
        this._observers = this.observers.filter(function (g) {
            return f !== g;
        });
    },
    dispatch: function (data) {
        this._observers.forEach(function (f) {
            f(data);
        });
    },
});

function Either() {}
function Left(val) {
    if (!(this instanceof Either)) {
        return new Left(val);
    }
    this.val = val;
}
Left.prototype = Object.create(Either.prototype);
function Right(val) {
    if (!(this instanceof Either)) {
        return new Right(val);
    }
    this.val = val;
}
Right.prototype = Object.create(Either.prototype);

function InputViewModel(initialState) {
    ObserverFactory.call(this);
    this._min = getProp(initialState, 'min');
    this._max = getProp(initialState, 'max');
    this._func = getProp(initialState, 'func');
    this._time = 0;
    this._isRunning = false;
    this._isPaused = false;
}
InputViewModel.prototype = Object.create(ObserverFactory.prototype);
Object.assign(InputViewModel.prototype, {
    isRunning: function () {
        return this._isRunning;
    },

    isPaused: function () {
        return this._isPaused;
    },

    start: function () {
        if (this._isRunning && !this._isPaused) return Left('Running already');
        if (!this._isRunning) {
            this._isRunning = true;
            this.dispatch('running');
        }
        if (this._isPaused) {
            this._isPaused = false;
            this.dispatch('paused');
        }
        this.dispatch('any');
        return Right();
    },

    pause: function () {
        if (!this._isRunning) return Left('Cannot pause when stopped');
        this._isPaused = !this._isPaused;
        this.dispatch('paused');
        this.dispatch('any');
        return Right();
    },

    stop: function () {
        if (!this._isRunning) return Left('Stopped already');
        this._isRunning = false;
        this._isPaused = false;
        this.dispatch('running');
        this.dispatch('paused');
        this.dispatch('any');
        return Right();
    },

    getMin: function () {
        return this._min;
    },

    setMin: function (min) {
        var sanitized = parseFloat(min);
        if (isNaN(sanitized)) return Left('Not a number');
        if (sanitized < -1000 || sanitized > 1000) return Left('Range must be between [-1000, 1000]');
        this._min = sanitized;
        this.dispatch('min');
        this.dispatch('any');
        return Right();
    },

    getMax: function () {
        return this._max;
    },

    setMax: function (max) {
        var sanitized = parseFloat(max);
        if (isNaN(sanitized)) return Left('Not a number');
        if (sanitized < -1000 || sanitized > 1000) return Left('Range must be between [-1000, 1000]');
        this._max = sanitized;
        this.dispatch('max');
        this.dispatch('any');
        return Right();
    },

    getStep: function () {
        return (this._max - this._min) / 50;
    },

    setFunc: function (func) {
        try {
            with (Math) {
                with ({
                    x: this._min,
                    y: this._min,
                    t: this._time
                }) {
                    var result = eval('(function () {"use strict"; return ' + func + ';})()');
                }
            }
        } catch (e) {
            return Left('Invalid expression (could not parse): ' + e.toString());
        }
        this._func = func;
        this.dispatch('func');
        this.dispatch('any');
        return Right();
    },

    getTime: function () {
        return this._time;
    },

    setTime: function (time) {
        var sanitized = parseFloat(time);
        if (isNaN(sanitized)) return Left('Not a number');
        if (sanitized < 0 || sanitized > 600) return Left('Time must be between [0, 600]');
        this._time = sanitized
        this.dispatch('time');
        this.dispatch('any');
        return Right();
    }
})

function InputView(model, el) {
    this.el = el;
    this.model = model;
    this.els = {
        min: qs(this.el, '[name="min"]'),
        max: qs(this.el, '[name="max"]'),
        func: qs(this.el, '[name="func"]'),
        time: qs(this.el, '[name="time"]'),
        timeRepr: qs(this.el, '[data-time-value]'),
        start: qs(this.el, '[name="start"]'),
        pause: qs(this.el, '[name="pause"]'),
        stop: qs(this.el, '[name="stop"]'),
        errors: qs(this.el, '[data-errors]'),
    };
    on(this.el, 'change', 'input[name="min"]', this.onMinChange.bind(this));
    on(this.el, 'change', 'input[name="max"]', this.onMaxChange.bind(this));
    on(this.el, 'change', 'input[name="func"]', this.onFuncChange.bind(this));
    on(this.el, 'change', 'input[name="time"]', this.onTimeChange.bind(this));
    on(this.el, 'click', 'button[name="start"]', this.onStart.bind(this));
    on(this.el, 'click', 'button[name="pause"]', this.onPause.bind(this));
    on(this.el, 'click', 'button[name="stop"]', this.onStop.bind(this));
    this.model.listen(function (kind) {
        if (kind === 'any') {
            this.update();
        }
    }.bind(this));
    this.update();
}
Object.assign(InputView.prototype, {
    update: function () {
        this.els.start.disabled = this.model.isRunning() && !this.model.isPaused();
        this.els.pause.disabled = !this.model.isRunning();
        this.els.stop.disabled  = !this.model.isRunning();
        this.els.time.disabled  = this.model.isRunning();
        this.els.timeRepr.textContent = this.model.getTime().toFixed(2);
    },

    setError: function (key, val, inputEl) {
        var label = document.createElement('label');
        label.setAttribute('data-error', key);
        label.textContent = val;
        if (inputEl && inputEl.id) {
            label.setAttribute('for', inputEl.id);
        }
        this.els.errors.appendChild(label);
    },

    clearError: function (key) {
        qsa(this.els.errors, '[data-error="' + key + '"]').forEach(function (el) {
            el.parentNode.removeChild(el);
        });
    },

    onMinChange: function (event) {
        var result = this.model.setMin(this.els.min.value);
        if (result instanceof Left) {
            this.setError('min', result.val, this.els.min);
        } else {
            this.clearError('min');
        }
    },

    onMaxChange: function (event) {
        var result = this.model.setMax(this.els.max.value);
        if (result instanceof Left) {
            this.setError('max', result.val, this.els.max);
        } else {
            this.clearError('max');
        }
    },

    onFuncChange: function (event) {
        var result = this.model.setFunc(this.els.func.value);
        if (result instanceof Left) {
            this.setError('func', result.val, this.els.func);
        } else {
            this.clearError('func');
        }
    },

    onTimeChange: function (event) {
        var result = this.model.setTime(this.els.time.value);
        if (result instanceof Left) {
            this.setError('time', result.val, this.els.time);
        } else {
            this.clearError('time');
        }
    },

    onStart: function (event) {
        var result = this.model.start();
        if (result instanceof Left) {
            this.setError('play', result.val, this.els.start);
        } else {
            this.clearError('play');
        }
    },

    onPause: function (event) {
        var result = this.model.pause();
        if (result instanceof Left) {
            this.setError('play', result.val, this.els.pause);
        } else {
            this.clearError('play');
        }
    },

    onStop: function (event) {
        var result = this.model.stop();
        if (result instanceof Left) {
            this.setError('play', result.val, this.els.stop);
        } else {
            this.clearError('play');
        }
    },
});

function GraphView(model, el) {
    this.model = model;
    this.el = el;
    this._renderHandle = null;
    this._resumeTime = null;
    this._elapsedTime = 0;
    this.model.listen(function (data) {
        if (data === 'running' || data === 'paused') {
            if (this.model.isRunning() && !this.model.isPaused()) {
                this._resumeRender();
            } else {
                this._stopRender();
            }
        }
    }.bind(this));

    this.renderer = new THREE.WebGLRenderer({
        canvas: this.el
    });
    this.renderer.setClearColor(0xffffff);
    this.initScene();
}
Object.assign(GraphView.prototype, {
    _resumeRender: function () {
        if (this._renderHandle !== null) {
            console.trace('This should never happen: double resume');
            return;
        }
        this._resumeTime = performance.now();
        this.render();
    },
    _stopRender: function () {
        if (this._renderHandle === null) {
            console.trace('This should never happen: double stop');
            return;
        }
        cancelAnimationFrame(this._renderHandle);
        if (this.model.isPaused) {
            this._elapsedTime += performance.now() - this._resumeTime;
        }
        if (!this.model.isRunning) {
            this._elapsedTime = 0;
        }
        this._renderHandle = null;
    },
    render: function () {
        var currentTime = (this._elapsedTime + performance.now() - this._resumeTime) / 1000;
        this.updateScene(currentTime);
        this.renderer.render(this.scene, this.camera);
        this._renderHandle = requestAnimationFrame(function () {
            this._renderHandle = null;
            this.render();
        }.bind(this));
    },
    updateScene: function (sec) {
        var update = function (fn, t) {
            var offset = 0;
            var MIN = this.model.getMin();
            var MAX = this.model.getMax();
            var STEP = this.model.getStep();
            for (var y = MIN; y < MAX; y += STEP) {
                for (var x = MIN; x < MAX; x += STEP) {
                    var ul = fn(x       , y       , t);
                    var ur = fn(x + STEP, y       , t);
                    var ll = fn(x       , y + STEP, t);
                    var lr = fn(x + STEP, y + STEP, t);
                    this.graphGeo.vertices[offset++].set(x       , ul, y       );
                    this.graphGeo.vertices[offset++].set(x       , ll, y + STEP);
                    this.graphGeo.vertices[offset++].set(x + STEP, ur, y       );
                    this.graphGeo.vertices[offset++].set(x + STEP, lr, y + STEP);
                }
            }
            this.graphGeo.computeFaceNormals();
            this.graphGeo.computeVertexNormals();
            this.graphGeo.verticesNeedUpdate = true;
        }.bind(this);
        update(function (x, y, t) {
            return 0.5 + (
                Math.sin(2 * ((y+x) + t * Math.PI / 3)) +
                Math.cos(2 * ((y-x) + t * Math.PI / 5)) +
                Math.sin(2 * (y + t * Math.PI / 7)) +
                Math.cos(2 * (x + t * Math.PI / 11)) +
                Math.sin(2 * (y + t * Math.PI / 17)) +
                Math.cos(2 * (x + t * Math.PI / 13))
            ) / 12;
        }, sec);
        this.camera.position.set(
            8 * Math.sin(Math.PI / 4 + Math.PI * 2 * sec / 300),
            4,
            8 * Math.cos(Math.PI / 4 + Math.PI * 2 * sec / 300)
        );
        this.camera.lookAt(new THREE.Vector3(0, 1, 0));
    },
    initScene: function () {
        this.scene = new THREE.Scene();

        var ptLight = new THREE.PointLight(0xffffff, 1, 30);
        ptLight.position.set(0, 6, 0);
        this.scene.add(ptLight);

        this.camera = new THREE.PerspectiveCamera(50, this.el.height / this.el.width, 0.1, 500);

        var MIN = this.model.getMin();
        var MAX = this.model.getMax();
        var STEP = this.model.getStep();

        var axisGrid = new THREE.GridHelper(MAX - MIN, (MAX - MIN) / STEP);
        this.scene.add(axisGrid);

        this.graphGeo = new THREE.Geometry();
        for (var y = MIN; y < MAX; y += STEP) {
            for (var x = MIN; x < MAX; x += STEP) {
                var offset = this.graphGeo.vertices.length;
                this.graphGeo.vertices.push(
                    new THREE.Vector3(0,0,0),
                    new THREE.Vector3(0,0,0),
                    new THREE.Vector3(0,0,0),
                    new THREE.Vector3(0,0,0)
                );
                this.graphGeo.faces.push(
                    new THREE.Face3(offset + 0, offset + 1, offset + 2),
                    new THREE.Face3(offset + 2, offset + 1, offset + 3)
                );
            }
        }
        var graphMat = new THREE.MeshLambertMaterial({
            color: 0x000080,
            side: THREE.DoubleSide
        });
        var graphMesh = new THREE.Mesh(this.graphGeo, graphMat);
        this.scene.add(graphMesh);
    }
});

var inputModel = new InputViewModel({
    min: parseFloat(qs(document.body, '[name="min"]').value),
    max: parseFloat(qs(document.body, '[name="max"]').value),
    func: qs(document.body, '[name="func"]').value,
    time: 0,
});
var inputView = new InputView(inputModel, qs(document.body, '[data-form]'));
var graphView = new GraphView(inputModel, qs(document.body, '[data-graph-canvas]'));
