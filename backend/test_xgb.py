import xgboost as xgb
import numpy as np
import time

class XGBProgressCallback(xgb.callback.TrainingCallback):
    def __init__(self, total_epochs):
        self.total_epochs = total_epochs
        self.start_time = time.time()
        
    def after_iteration(self, model, epoch, evals_log):
        print("evals_log:", evals_log)
        return False

X = np.random.rand(100, 2)
y = np.random.rand(100)

model = xgb.XGBRegressor(n_estimators=2, tree_method="hist", callbacks=[XGBProgressCallback(total_epochs=2)])
try:
    model.fit(
        X, y,
        eval_set=[(X, y)],
        verbose=False
    )
    print("Success")
except Exception as e:
    import traceback
    traceback.print_exc()
