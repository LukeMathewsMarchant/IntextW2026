
from fastapi import FastAPI
from pydantic import BaseModel
import pandas as pd
import joblib

app = FastAPI(title='Social Media Post Predictor')

bundle = joblib.load('../artifacts/social_media_posts_production_model.joblib')
model = bundle['model_pipeline']
features = bundle['features']

class PostInput(BaseModel):
    data: dict

@app.get('/health')
def health():
    return {'status': 'ok'}

@app.post('/predict')
def predict(payload: PostInput):
    row = {k: payload.data.get(k, None) for k in features}
    X = pd.DataFrame([row])
    pred = float(model.predict(X)[0])
    return {
        'predicted_estimated_donation_value_php': round(pred, 2),
        'features_used': features
    }
