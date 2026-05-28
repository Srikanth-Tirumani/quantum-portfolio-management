import os
import torch
import torch.optim as optim
import matplotlib.pyplot as plt
import numpy as np

from src.data_fetcher import fetch_financial_data
from src.portfolio_env import PortfolioEnv
from src.classical_agent import create_classical_ppo_agent, train_agent
from src.quantum_agent import get_quantum_actor
from src.evaluate import evaluate_portfolio_performance, backtest_agent

def main():
    print("="*60)
    print("🚀 Quantum Reinforcement Learning Portfolio Management")
    print("="*60)
    
    # 1. Fetch Data
    tickers = ["AAPL", "MSFT", "GOOGL", "JPM"]
    start_date = "2020-01-01"
    end_date = "2023-01-01"
    
    prices, returns = fetch_financial_data(tickers, start_date, end_date)
    returns_array = returns.values
    
    # Simple covariance matrix based on historic returns (optional, not heavily used in simple env)
    cov_matrix = returns.cov().values
    
    # 2. Setup Environment
    # We will split data into train and test
    split = int(len(returns_array) * 0.8)
    train_returns = returns_array[:split]
    test_returns = returns_array[split:]
    
    train_env = PortfolioEnv(train_returns, cov_matrix, window_size=5)
    test_env = PortfolioEnv(test_returns, cov_matrix, window_size=5)
    
    # 3. Classical Baseline (PPO)
    print("\n--- Training Classical Baseline (PPO) ---")
    ppo_model = create_classical_ppo_agent(train_env)
    ppo_model = train_agent(ppo_model, total_timesteps=5000)
    
    print("Evaluating Classical Agent...")
    ppo_history = backtest_agent(test_env, ppo_model, is_quantum=False)
    evaluate_portfolio_performance(ppo_history, title="Classical PPO Performance")
    
    # 4. Quantum Agent (VQC)
    print("\n--- Initializing Quantum RL Agent ---")
    obs_dim = train_env.observation_space.shape[0]
    n_assets = train_env.action_space.shape[0]
    
    quantum_actor = get_quantum_actor(obs_dim, n_assets)
    optimizer = optim.Adam(quantum_actor.parameters(), lr=0.01)
    
    # Simple Policy Gradient Training loop for Quantum Actor
    print("Training Quantum Agent (Simplified PG) for 50 episodes...")
    epochs = 50
    vqc_losses = []
    for epoch in range(epochs):
        obs, _ = train_env.reset()
        done = False
        truncated = False
        epoch_reward = 0
        
        while not (done or truncated):
            obs_tensor = torch.tensor(obs, dtype=torch.float32).unsqueeze(0)
            
            # Forward pass
            action_probs = quantum_actor(obs_tensor)
            
            # Form action
            action = action_probs.squeeze(0).detach().numpy()
            
            # Step map
            next_obs, reward, done, truncated, _ = train_env.step(action)
            epoch_reward += reward
            
            # Maximize reward (minimize -reward)
            # In a real setup, we would use REINFORCE with a Critic baseline.
            loss = -torch.log(action_probs.max()) * reward
            
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            
            obs = next_obs
            
        if (epoch + 1) % 10 == 0:
            print(f"Epoch {epoch+1}/{epochs} - Reward: {epoch_reward:.4f}")
            
    print("Evaluating Quantum Agent...")
    quantum_history = backtest_agent(test_env, quantum_actor, is_quantum=True)
    evaluate_portfolio_performance(quantum_history, title="Quantum RL Performance")
    
    # 5. Compare Plot
    print("\n--- Final Results ---")
    plt.figure(figsize=(12, 6))
    plt.plot(ppo_history, label="Classical PPO", color="blue", linewidth=2)
    plt.plot(quantum_history, label="Quantum VQC", color="purple", linewidth=2, linestyle='--')
    plt.title("Classical vs Quantum RL Portfolio Management")
    plt.xlabel("Trading Days (Test Set)")
    plt.ylabel("Portfolio Value ($)")
    plt.legend()
    plt.grid(True, alpha=0.3)
    plt.savefig("classical_vs_quantum.png")
    
    print("Done! Check the saved PNGs for performance graphs.")

if __name__ == "__main__":
    main()
