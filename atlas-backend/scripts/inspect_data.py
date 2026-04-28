import pandas as pd

data_path = r"E:\eclipse model\data\combined_data.csv"

df = pd.read_csv(data_path)

print("Dataset Shape:", df.shape)
print("\nColumns:")
print(df.columns)

print("\nFirst 5 rows:")
print(df.head())