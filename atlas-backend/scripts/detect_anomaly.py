import pandas as pd
import joblib

# Load trained model
model = joblib.load(r"E:\eclipse model\models\anomaly_model.pkl")

# Load scaler
scaler = joblib.load(r"E:\eclipse model\models\scaler.pkl")

# Example device telemetry input
device_data = [[
    0.8, 0.5, 0.3,
    0.9, 0.4, 0.2,
    0.7, 0.3, 0.1,
    0.6, 0.2, 0.1
]]

# Convert to dataframe
df = pd.DataFrame(device_data)

# Scale data
scaled_data = scaler.transform(df)

# Predict anomaly
prediction = model.predict(scaled_data)

if prediction[0] == -1:
    print("⚠ Anomaly Detected")
else:
    print("✅ Normal Behavior")