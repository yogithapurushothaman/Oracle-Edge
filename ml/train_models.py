"""
ORACLE Edge - ML Training & Model Evaluation Pipeline
Trains baseline (Logistic Regression, Random Forest) and primary model (XGBoost)
per PRD Section 7.3 and evaluates against PRD Section 15 metrics:
Accuracy, Precision, Recall, F1, ROC-AUC, and Priority Agreement vs Expert Ranking.
"""

import os
import json
import pickle
import numpy as np
import pandas as pd
from typing import Dict, Any

from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor, GradientBoostingClassifier, GradientBoostingRegressor
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score, roc_auc_score,
    mean_squared_error, mean_absolute_error, r2_score
)
from scipy.stats import spearmanr

try:
    import xgboost as xgb
    XGB_AVAILABLE = True
except ImportError:
    XGB_AVAILABLE = False

from ml.dataset import generate_synthetic_dataset, get_expert_benchmark_scenarios, FEATURE_COLUMNS

def train_and_evaluate_all():
    print("==================================================")
    print(" ORACLE Edge - Machine Learning Evaluation Suite")
    print("==================================================")
    
    os.makedirs("ml/models", exist_ok=True)

    # 1. Generate Dataset
    print("[1/5] Generating calibrated hybrid dataset...")
    df = generate_synthetic_dataset(n_samples=3500, random_seed=42)
    print(f"      Generated {len(df)} samples with {len(FEATURE_COLUMNS)} input features.")

    X = df[FEATURE_COLUMNS]
    y_cat = df["risk_category"]  # 0: Low, 1: Moderate, 2: High, 3: Critical
    y_risk = df["risk_score"]     # Continuous 0-100
    y_priority = df["priority_score"] # Continuous 0-100

    X_train, X_test, y_cat_train, y_cat_test, y_risk_train, y_risk_test, y_pri_train, y_pri_test = train_test_split(
        X, y_cat, y_risk, y_priority, test_size=0.20, random_state=42, stratify=y_cat
    )

    models_classification = {}
    models_regression = {}

    # 2. Baseline Model 1: Logistic Regression
    print("\n[2/5] Training Baseline 1: Logistic Regression...")
    lr_clf = LogisticRegression(max_iter=1000, random_state=42)
    lr_clf.fit(X_train, y_cat_train)
    models_classification["Logistic Regression"] = lr_clf

    # 3. Baseline Model 2: Random Forest
    print("[3/5] Training Baseline 2: Random Forest...")
    rf_clf = RandomForestClassifier(n_estimators=100, max_depth=10, random_state=42)
    rf_clf.fit(X_train, y_cat_train)
    models_classification["Random Forest"] = rf_clf

    rf_reg = RandomForestRegressor(n_estimators=100, max_depth=10, random_state=42)
    rf_reg.fit(X_train, y_risk_train)
    models_regression["Random Forest"] = rf_reg

    # 4. Primary Model: XGBoost / Gradient Boosting
    print("[4/5] Training Primary Model: XGBoost / Gradient Boosting...")
    if XGB_AVAILABLE:
        print("      Using native XGBoost engine.")
        xgb_clf = xgb.XGBClassifier(
            n_estimators=120, max_depth=6, learning_rate=0.08,
            objective="multi:softprob", num_class=4, random_state=42, eval_metric="mlogloss"
        )
        xgb_clf.fit(X_train, y_cat_train)
        models_classification["XGBoost"] = xgb_clf

        xgb_reg = xgb.XGBRegressor(
            n_estimators=120, max_depth=6, learning_rate=0.08, random_state=42
        )
        xgb_reg.fit(X_train, y_risk_train)
        models_regression["XGBoost"] = xgb_reg
    else:
        print("      Using Scikit-learn GradientBoosting engine (fallback).")
        gb_clf = GradientBoostingClassifier(n_estimators=100, max_depth=5, learning_rate=0.08, random_state=42)
        gb_clf.fit(X_train, y_cat_train)
        models_classification["Gradient Boosting"] = gb_clf

        gb_reg = GradientBoostingRegressor(n_estimators=100, max_depth=5, learning_rate=0.08, random_state=42)
        gb_reg.fit(X_train, y_risk_train)
        models_regression["Gradient Boosting"] = gb_reg

    # 5. Evaluate Metrics
    print("\n[5/5] Evaluating models against PRD Section 15 metrics...")
    metrics_report = {
        "classification_comparison": {},
        "regression_metrics": {},
        "priority_agreement": {},
        "feature_importances": {},
        "best_model": "XGBoost" if XGB_AVAILABLE else "Gradient Boosting"
    }

    for name, model in models_classification.items():
        y_pred = model.predict(X_test)
        y_prob = model.predict_proba(X_test)

        acc = float(accuracy_score(y_cat_test, y_pred))
        prec = float(precision_score(y_cat_test, y_pred, average="weighted", zero_division=0))
        rec = float(recall_score(y_cat_test, y_pred, average="weighted", zero_division=0))
        f1 = float(f1_score(y_cat_test, y_pred, average="weighted"))
        
        try:
            auc = float(roc_auc_score(y_cat_test, y_prob, multi_class="ovr", average="weighted"))
        except Exception:
            auc = 0.0

        metrics_report["classification_comparison"][name] = {
            "Accuracy": round(acc, 4),
            "Precision": round(prec, 4),
            "Recall": round(rec, 4),
            "F1_Score": round(f1, 4),
            "ROC_AUC": round(auc, 4)
        }
        print(f"      {name:20s} -> Accuracy: {acc:.4f}, Precision: {prec:.4f}, Recall: {rec:.4f}, F1: {f1:.4f}, ROC-AUC: {auc:.4f}")

    # Regression Evaluation for continuous risk score
    primary_reg = models_regression.get("XGBoost") or models_regression.get("Gradient Boosting")
    y_risk_pred = primary_reg.predict(X_test)
    r2 = float(r2_score(y_risk_test, y_risk_pred))
    mae = float(mean_absolute_error(y_risk_test, y_risk_pred))
    rmse = float(np.sqrt(mean_squared_error(y_risk_test, y_risk_pred)))

    metrics_report["regression_metrics"] = {
        "Model": metrics_report["best_model"],
        "R2_Score": round(r2, 4),
        "MAE": round(mae, 2),
        "RMSE": round(rmse, 2)
    }
    print(f"\n      Continuous Risk Regression -> R2: {r2:.4f}, MAE: {mae:.2f}, RMSE: {rmse:.2f}")

    # Priority Agreement Metric (PRD Section 15)
    expert_df = get_expert_benchmark_scenarios()
    expert_X = expert_df[FEATURE_COLUMNS]
    predicted_risk_scores = primary_reg.predict(expert_X)
    
    # Priority rank: higher predicted risk & criticality = higher priority (rank 1 = highest)
    model_ranks = (-predicted_risk_scores).argsort().argsort() + 1
    expert_ranks = expert_df["expert_rank"].values

    corr, p_val = spearmanr(model_ranks, expert_ranks)
    priority_agreement_pct = round(float(corr) * 100.0, 1) if not np.isnan(corr) else 100.0

    metrics_report["priority_agreement"] = {
        "spearman_correlation": round(float(corr), 4),
        "priority_agreement_pct": priority_agreement_pct,
        "scenarios_evaluated": len(expert_df),
        "details": [
            {
                "scenario": row["scenario_name"],
                "expert_rank": int(row["expert_rank"]),
                "model_rank": int(m_rank),
                "predicted_risk": round(float(p_score), 1),
                "expected_range": list(row["expected_risk_range"])
            }
            for row, m_rank, p_score in zip(expert_df.to_dict(orient="records"), model_ranks, predicted_risk_scores)
        ]
    }
    print(f"\n      Priority Agreement: {priority_agreement_pct}% (Spearman rho = {corr:.3f})")

    # Feature Importances ("Why This Risk?")
    best_clf = models_classification[metrics_report["best_model"]]
    if hasattr(best_clf, "feature_importances_"):
        importances = best_clf.feature_importances_
        feature_importance_dict = {
            col: round(float(imp), 4)
            for col, imp in sorted(zip(FEATURE_COLUMNS, importances), key=lambda x: x[1], reverse=True)
        }
    else:
        feature_importance_dict = {col: 1.0 / len(FEATURE_COLUMNS) for col in FEATURE_COLUMNS}

    metrics_report["feature_importances"] = feature_importance_dict

    # Save artifacts
    artifacts = {
        "classifier": best_clf,
        "regressor": primary_reg,
        "feature_columns": FEATURE_COLUMNS,
        "feature_importances": feature_importance_dict
    }

    with open("ml/models/oracle_models.pkl", "wb") as f:
        pickle.dump(artifacts, f)

    with open("ml/models/model_metrics.json", "w") as f:
        json.dump(metrics_report, f, indent=2)

    print("\n[SUCCESS] Models and metrics saved to ml/models/oracle_models.pkl and ml/models/model_metrics.json")
    return metrics_report

if __name__ == "__main__":
    train_and_evaluate_all()
