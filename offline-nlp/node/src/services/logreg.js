/**
 * Multinomial logistic regression inference.
 *
 * Port of scikit-learn's `LogisticRegression.predict_proba` for the multinomial
 * (softmax) case, which is what a 25-class lbfgs-solved model uses.
 *
 *   decision = x @ coefᵀ + intercept
 *   proba    = softmax(decision)
 *
 * The max-subtraction in the softmax mirrors `sklearn.utils.extmath.softmax`, so the
 * floating-point result matches rather than merely being mathematically equivalent.
 *
 * Training lives in `scripts/train.js`; this module only scores.
 */

export class LogisticRegressionClassifier {
  /** @param {{classes: string[], nClasses: number, nFeatures: number, coef: Float64Array, intercept: Float64Array}} c */
  constructor({ classes, nClasses, nFeatures, coef, intercept }) {
    this.classes = classes;
    this.nClasses = nClasses;
    this.nFeatures = nFeatures;
    this.coef = coef; // row-major, nClasses x nFeatures
    this.intercept = intercept;
  }

  /**
   * Raw decision values, one per class.
   * @param {{indices: Int32Array, values: Float64Array}} sparse
   * @returns {Float64Array}
   */
  decisionFunction({ indices, values }) {
    const { nClasses, nFeatures, coef, intercept } = this;
    const scores = new Float64Array(nClasses);
    const nnz = indices.length;

    for (let c = 0; c < nClasses; c += 1) {
      const rowStart = c * nFeatures;
      let acc = 0;
      for (let k = 0; k < nnz; k += 1) {
        acc += coef[rowStart + indices[k]] * values[k];
      }
      scores[c] = acc + intercept[c];
    }
    return scores;
  }

  /**
   * Class probabilities.
   * @param {{indices: Int32Array, values: Float64Array}} sparse
   * @returns {Float64Array}
   */
  predictProba(sparse) {
    const scores = this.decisionFunction(sparse);

    let max = -Infinity;
    for (let i = 0; i < scores.length; i += 1) if (scores[i] > max) max = scores[i];

    let sum = 0;
    for (let i = 0; i < scores.length; i += 1) {
      scores[i] = Math.exp(scores[i] - max);
      sum += scores[i];
    }
    for (let i = 0; i < scores.length; i += 1) scores[i] /= sum;

    return scores;
  }

  /**
   * Highest-probability class and its probability.
   *
   * Ties resolve to the lowest class index, matching numpy's `argmax`.
   *
   * @param {{indices: Int32Array, values: Float64Array}} sparse
   * @returns {{intent: string, confidence: number, probabilities: Float64Array}}
   */
  predict(sparse) {
    const probabilities = this.predictProba(sparse);
    let best = 0;
    for (let i = 1; i < probabilities.length; i += 1) {
      if (probabilities[i] > probabilities[best]) best = i;
    }
    return {
      intent: this.classes[best],
      confidence: probabilities[best],
      probabilities,
    };
  }
}

export default { LogisticRegressionClassifier };
