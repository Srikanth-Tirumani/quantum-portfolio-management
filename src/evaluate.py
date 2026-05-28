import matplotlib.pyplot as plt
import numpy as np

def evaluate_portfolio_performance(history, title="Portfolio Performance"):
    """
    Plots the portfolio values over time.
    
    Args:
        history (list): List or array of portfolio values at each time step.
        title (str): The plot title.
    """
    plt.figure(figsize=(12, 6))
    
    # Calculate baseline (Buy and Hold)
    plt.plot(history, label="RL Agent Portfolio Value", linewidth=2, color="blue")
    
    plt.title(title, fontsize=16)
    plt.xlabel("Trading Days", fontsize=12)
    plt.ylabel("Portfolio Value ($)", fontsize=12)
    plt.grid(True, alpha=0.3)
    plt.legend()
    plt.tight_layout()
    plt.savefig(f"{title.replace(' ', '_').lower()}.png")
    plt.close()

def backtest_agent(env, model, is_quantum=False):
    """
    Runs an episode in the environment without training to measure cumulative return.
    """
    obs, info = env.reset()
    done = False
    truncated = False
    
    while not (done or truncated):
        if is_quantum:
            import torch
            # Convert obs to tensor
            obs_tensor = torch.tensor(obs, dtype=torch.float32).unsqueeze(0)
            # Evaluate model
            model.eval()
            with torch.no_grad():
                action = model(obs_tensor).squeeze(0).numpy()
        else:
            action, _states = model.predict(obs, deterministic=True)
            
        obs, reward, done, truncated, info = env.step(action)
        
    return env.history
