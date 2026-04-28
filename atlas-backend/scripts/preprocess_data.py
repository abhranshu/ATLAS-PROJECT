import pandas as pd

data_path = r"E:\eclipse model\data\combined_data.csv"

df = pd.read_csv(data_path)

selected_features = [
    "MI_dir_L5_weight",
    "MI_dir_L5_mean",
    "MI_dir_L5_variance",
    "MI_dir_L3_weight",
    "MI_dir_L3_mean",
    "MI_dir_L3_variance",
    "MI_dir_L1_weight",
    "MI_dir_L1_mean",
    "MI_dir_L1_variance",
    "H_L5_weight",
    "H_L5_mean",
    "H_L5_variance"
]

df_selected = df[selected_features]

print("Selected dataset shape:", df_selected.shape)

df_selected.to_csv(r"E:\eclipse model\data\processed_data.csv", index=False)

print("Processed dataset saved.")