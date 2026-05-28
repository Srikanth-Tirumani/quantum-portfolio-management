import torch
from stable_baselines3 import PPO

def create_classical_ppo_agent(env, device="cpu"):
    """
    Creates a standard Proximal Policy Optimization (PPO) Deep RL agent.
    This acts as the baseline to compare against the Quantum RL Agent.
    
    Args:
        env (gymnasium.Env): The configured `PortfolioEnv` instance.
        device (str, optional): Computation device ("cpu" or "cuda"). Defaults to "cpu".
        
    Returns:
        stable_baselines3.PPO: An untrained PPO model.
    """
    print("Initializing Classical PPO Agent...")
    
    # MLP Policy with standard Multi-Layer Perceptron architecture
    # Default policy_kwargs builds a 2-layer network with 64 units each.
    # Learning rate is set relatively small for continuous portfolio weights.
    model = PPO("MlpPolicy", env, verbose=0, learning_rate=0.0003, device=device)
    return model

def train_agent(model, total_timesteps=10000):
    """
    Trains the Stable-Baselines3 model.
    """
    print(f"Training Agent for {total_timesteps} timesteps...")
    model.learn(total_timesteps=total_timesteps, progress_bar=True)
    return model
