/**
 * L-BFGS with a strong-Wolfe line search.
 *
 * Replaces the `lbfgs` solver scipy provides to scikit-learn. This is the one part of the
 * migration that cannot be bit-faithful: a different optimizer implementation follows a
 * different trajectory and lands on slightly different weights. The objective, penalty and
 * hyperparameters are identical, so the resulting model is equivalent in quality, not
 * identical in value. `scripts/train.js` measures that on a held-out split.
 *
 * References: Nocedal & Wright, "Numerical Optimization" 2nd ed., Algorithm 7.5 (two-loop
 * recursion) and Algorithm 3.5/3.6 (strong Wolfe line search with cubic interpolation).
 */

const DEFAULTS = {
  maxIterations: 1000,
  historySize: 10,
  gradientTolerance: 1e-5, // scipy's `pgtol` equivalent (max-norm of the gradient)
  c1: 1e-4, // Armijo (sufficient decrease)
  c2: 0.9, // strong-Wolfe curvature
  maxLineSearchSteps: 25,
};

function dot(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) sum += a[i] * b[i];
  return sum;
}

function maxAbs(v) {
  let m = 0;
  for (let i = 0; i < v.length; i += 1) {
    const a = Math.abs(v[i]);
    if (a > m) m = a;
  }
  return m;
}

/**
 * Minimise `f`.
 *
 * @param {(x: Float64Array) => {loss: number, gradient: Float64Array}} evaluate
 * @param {Float64Array} x0 starting point, mutated in place and returned
 * @param {object} [options]
 * @param {(info: {iteration: number, loss: number, gradNorm: number}) => void} [onIteration]
 * @returns {{x: Float64Array, loss: number, iterations: number, converged: boolean}}
 */
export function minimize(evaluate, x0, options = {}, onIteration) {
  const opts = { ...DEFAULTS, ...options };
  const n = x0.length;

  let x = x0;
  let { loss, gradient } = evaluate(x);

  const sHistory = [];
  const yHistory = [];
  const rhoHistory = [];

  let iteration = 0;
  let converged = false;

  for (; iteration < opts.maxIterations; iteration += 1) {
    const gradNorm = maxAbs(gradient);
    if (onIteration) onIteration({ iteration, loss, gradNorm });
    if (gradNorm <= opts.gradientTolerance) {
      converged = true;
      break;
    }

    // --- two-loop recursion: direction = -H * gradient ---------------------
    const q = Float64Array.from(gradient);
    const alphas = new Array(sHistory.length);

    for (let i = sHistory.length - 1; i >= 0; i -= 1) {
      const alpha = rhoHistory[i] * dot(sHistory[i], q);
      alphas[i] = alpha;
      const y = yHistory[i];
      for (let k = 0; k < n; k += 1) q[k] -= alpha * y[k];
    }

    // Initial Hessian scaling (Nocedal & Wright eq. 7.20).
    if (sHistory.length > 0) {
      const last = sHistory.length - 1;
      const sy = dot(sHistory[last], yHistory[last]);
      const yy = dot(yHistory[last], yHistory[last]);
      const gamma = yy > 0 ? sy / yy : 1;
      for (let k = 0; k < n; k += 1) q[k] *= gamma;
    }

    for (let i = 0; i < sHistory.length; i += 1) {
      const beta = rhoHistory[i] * dot(yHistory[i], q);
      const s = sHistory[i];
      const diff = alphas[i] - beta;
      for (let k = 0; k < n; k += 1) q[k] += diff * s[k];
    }

    const direction = q;
    for (let k = 0; k < n; k += 1) direction[k] = -direction[k];

    let dirDeriv = dot(gradient, direction);
    if (dirDeriv >= 0) {
      // Not a descent direction (curvature broke down) — reset to steepest descent.
      for (let k = 0; k < n; k += 1) direction[k] = -gradient[k];
      dirDeriv = dot(gradient, direction);
      sHistory.length = 0;
      yHistory.length = 0;
      rhoHistory.length = 0;
    }

    // --- line search -------------------------------------------------------
    const step = strongWolfe(evaluate, x, loss, gradient, direction, dirDeriv, opts);
    if (step === null) {
      // Line search failed to make progress; further iterations cannot help.
      break;
    }

    const { stepSize, nextX, nextLoss, nextGradient } = step;

    const s = new Float64Array(n);
    const y = new Float64Array(n);
    for (let k = 0; k < n; k += 1) {
      s[k] = nextX[k] - x[k];
      y[k] = nextGradient[k] - gradient[k];
    }

    const sy = dot(s, y);
    // Skip the update when the curvature condition is violated, keeping H positive definite.
    if (sy > 1e-10) {
      sHistory.push(s);
      yHistory.push(y);
      rhoHistory.push(1 / sy);
      if (sHistory.length > opts.historySize) {
        sHistory.shift();
        yHistory.shift();
        rhoHistory.shift();
      }
    }

    x = nextX;
    loss = nextLoss;
    gradient = nextGradient;

    if (stepSize === 0) break;
  }

  return { x, loss, iterations: iteration, converged };
}

/**
 * Strong-Wolfe line search (bracket then zoom).
 * @returns {{stepSize: number, nextX: Float64Array, nextLoss: number, nextGradient: Float64Array}|null}
 */
function strongWolfe(evaluate, x, loss0, grad0, direction, dirDeriv0, opts) {
  const n = x.length;
  const at = (alpha) => {
    const candidate = new Float64Array(n);
    for (let k = 0; k < n; k += 1) candidate[k] = x[k] + alpha * direction[k];
    const { loss, gradient } = evaluate(candidate);
    return { candidate, loss, gradient, slope: dot(gradient, direction) };
  };

  let alphaPrev = 0;
  let lossPrev = loss0;
  let slopePrev = dirDeriv0;
  let alpha = 1;

  for (let i = 0; i < opts.maxLineSearchSteps; i += 1) {
    const trial = at(alpha);

    const armijoFailed = trial.loss > loss0 + opts.c1 * alpha * dirDeriv0;
    if (armijoFailed || (i > 0 && trial.loss >= lossPrev)) {
      return zoom(at, alphaPrev, lossPrev, slopePrev, alpha, loss0, dirDeriv0, opts);
    }

    if (Math.abs(trial.slope) <= -opts.c2 * dirDeriv0) {
      return {
        stepSize: alpha,
        nextX: trial.candidate,
        nextLoss: trial.loss,
        nextGradient: trial.gradient,
      };
    }

    if (trial.slope >= 0) {
      return zoom(at, alpha, trial.loss, trial.slope, alphaPrev, loss0, dirDeriv0, opts);
    }

    alphaPrev = alpha;
    lossPrev = trial.loss;
    slopePrev = trial.slope;
    alpha *= 2;
  }

  return null;
}

function zoom(at, aLo, lossLo, slopeLo, aHi, loss0, dirDeriv0, opts) {
  let lo = aLo;
  let hi = aHi;
  let fLo = lossLo;
  let sLo = slopeLo;

  for (let i = 0; i < opts.maxLineSearchSteps; i += 1) {
    // Bisection is used rather than cubic interpolation: slower to converge but it cannot
    // produce an out-of-bracket step, which matters more than a few extra evaluations here.
    const alpha = 0.5 * (lo + hi);
    if (!Number.isFinite(alpha) || Math.abs(hi - lo) < 1e-12) break;

    const trial = at(alpha);

    if (trial.loss > loss0 + opts.c1 * alpha * dirDeriv0 || trial.loss >= fLo) {
      hi = alpha;
    } else {
      if (Math.abs(trial.slope) <= -opts.c2 * dirDeriv0) {
        return {
          stepSize: alpha,
          nextX: trial.candidate,
          nextLoss: trial.loss,
          nextGradient: trial.gradient,
        };
      }
      if (trial.slope * (hi - lo) >= 0) hi = lo;
      lo = alpha;
      fLo = trial.loss;
      sLo = trial.slope;
    }
  }

  if (lo === 0) return null;
  const final = at(lo);
  return {
    stepSize: lo,
    nextX: final.candidate,
    nextLoss: final.loss,
    nextGradient: final.gradient,
  };
}

export default { minimize };
