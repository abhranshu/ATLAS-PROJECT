import pandas as pd
import os

data_folder = r"E:\eclipse model\data\nbaiot"
all_data = []

for root, dirs, files in os.walk(data_folder):
    for file in files:
        if file.endswith(".csv") and "data_summary" not in file and "device_info" not in file:
            
            path = os.path.join(root, file)
            print("Reading:", path)

            try:
                df = pd.read_csv(path, nrows=5000)   # take only 5000 rows per file
                all_data.append(df)
            except Exception as e:
                print("Skipping file:", file)
                print(e)

combined = pd.concat(all_data, ignore_index=True)

output_path = r"E:\eclipse model\data\combined_data.csv"
combined.to_csv(output_path, index=False)

print("Dataset created successfully!")
print("Final shape:", combined.shape)