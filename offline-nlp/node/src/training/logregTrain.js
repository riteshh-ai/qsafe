/**
 * Multinomial logistic regression training.
 *
 * Objective matches `sklearn.linear_model.LogisticRegression(C=..., penalty='l2',
 * solver='lbfgs')` for the multinomial case:
 *
 *   min_W  -sum_i log softmax(W x_i + b)[y_i]  +  (1 / (2C)) * ||W||_F^2
 *
 * Note the L2 term excludes the intercept, as sklearn does, and the penalty is scaled by
 * 1/(2C) rather than averaged over samples — again matching sklearn, which sums the
 * per-sample loss instead of averaging it.
 */
import { minimize } from './lbfgs.js';

/**
 * @param {{indices: Int32Array, values: Float64Array}[]} X sparse rows
 * @param {number[]} y class index per row
 * @param {{nFeatures: number, nClasses: number, C?: number, maxIterations?: number,
 *          tolerance?: number, verbose?: boolean}} options
 * @returns {{coef: Float64Array, intercept: Float64Array, loss: number,
 *            iterations: number, converged: boolean}}
 */
export function trainLogisticRegression(X, y, options) {
  const {
    nFeatures,
    nClasses,
    C = 5.0,
    maxIterations = 1000,
    tolerance = 1e-5,
    verbose = false,
  } = options;

  const nSamples = X.length;
  if (nSamples !== y.length) throw new Error('X and y length mismatch');

  // Parameter vector: [coef (nClasses x nFeatures) | intercept (nClasses)]
  const coefSize = nClasses * nFeatures;
  const params = new Float64Array(coefSize + nClasses);
  const l2 = 1 / (2 * C);

  const scores = new Float64Array(nClasses);
  const probabilities = new Float64Array(nClasses);

  const evaluate = (w) => {
    let loss = 0;
    const gradient = new Float64Array(w.length);

    for (let i = 0; i < nSamples; i += 1) {
      const { indices, values } = X[i];
      const nnz = indices.length;

      // scores = W x + b
      let max = -Infinity;
      for (let c = 0; c < nClasses; c += 1) {
        const row = c * nFeatures;
        let acc = w[coefSize + c];
        for (let k = 0; k < nnz; k += 1) acc += w[row + indices[k]] * values[k];
        scores[c] = acc;
        if (acc > max) max = acc;
      }

      // stable softmax
      let sum = 0;
      for (let c = 0; c < nClasses; c += 1) {
        probabilities[c] = Math.exp(scores[c] - max);
        sum += probabilities[c];
      }
      const logSum = Math.log(sum) + max;

      const target = y[i];
      loss += logSum - scores[target];

      // dL/dscore_c = p_c - 1[c == target]
      for (let c = 0; c < nClasses; c += 1) {
        const delta = probabilities[c] / sum - (c === target ? 1 : 0);
        if (delta === 0) continue;
        const row = c * nFeatures;
        for (let k = 0; k < nnz; k += 1) {
          gradient[row + indices[k]] += delta * values[k];
        }
        gradient[coefSize + c] += delta;
      }
    }

    // L2 penalty on the weights only, never the intercept.
    let penalty = 0;
    for (let j = 0; j < coefSize; j += 1) {
      penalty += w[j] * w[j];
      gradient[j] += 2 * l2 * w[j];
    }
    loss += l2 * penalty;

    return { loss, gradient };
  };

  const result = minimize(
    evaluate,
    params,
    { maxIterations, gradientTolerance: tolerance },
    verbose
      ? ({ iteration, loss, gradNorm }) => {
          if (iteration % 25 === 0) {
            console.log(
              `   iter ${String(iteration).padStart(4)}  loss ${loss.toFixed(6)}  |grad|inf ${gradNorm.toExponential(3)}`,
            );
          }
        }
      : undefined,
  );

  return {
    coef: result.x.slice(0, coefSize),
    intercept: result.x.slice(coefSize),
    loss: result.loss,
    iterations: result.iterations,
    converged: result.converged,
  };
}

export default { trainLogisticRegression };
