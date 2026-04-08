
from fastapi import FastAPI
from pydantic import BaseModel
import pandas as pd
import joblib

app = FastAPI(title='Lighthouse Model API')

bundle = joblib.load('../artifacts/lighthouse_production_model.joblib')
model = bundle['model_pipeline']
features = bundle['features']
target = bundle['target']

class PredictInput(BaseModel):
    data: dict

@app.get('/health')
def health():
    return {'status': 'ok'}

@app.post('/predict')
def predict(payload: PredictInput):
    row = {f: payload.data.get(f, None) for f in features}
    X = pd.DataFrame([row])
    pred = float(model.predict(X)[0])
    return {
        'target': target,
        'prediction': round(pred, 4),
        'features_used': features
    }
