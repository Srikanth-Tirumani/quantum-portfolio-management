import gymnasium as gym
from gymnasium import spaces
import numpy as np

class PortfolioEnv(gym.Env):
    """
    A custom Gymnasium environment for simulating a financial portfolio.
    The agent allocates weights across N assets to maximize returns.
    """
    metadata = {'render_modes': ['human']}

    def __init__(self, expected_returns, covariance_matrix, initial_balance=10000.0,
                 transaction_cost=0.001, window_size=5):
        """
        Args:
            expected_returns (np.ndarray): Historical return matrix [timestamps, assets]
            covariance_matrix (np.ndarray): Historical covariance matrix [assets, assets]
            initial_balance (float): Initial cash balance.
            transaction_cost (float): Friction cost for rebalancing.
            window_size (int): Trailing window size for observation state.
        """
        super(PortfolioEnv, self).__init__()
        
        self.returns_data = expected_returns
        self.n_assets = expected_returns.shape[1]
        self.n_steps = expected_returns.shape[0]
        self.window_size = window_size
        
        self.initial_balance = initial_balance
        self.transaction_cost = transaction_cost
        
        # Action space: portfolio weights summing to 1.
        # Implemented as continuous values between 0 and 1.
        self.action_space = spaces.Box(low=0.0, high=1.0, shape=(self.n_assets,), dtype=np.float32)
        
        # Observation space: 
        # previous `window_size` days of returns (window_size * n_assets) + current weights (n_assets) + balance (1)
        obs_dim = self.window_size * self.n_assets + self.n_assets + 1
        self.observation_space = spaces.Box(low=-np.inf, high=np.inf, shape=(obs_dim,), dtype=np.float32)
        
        self.reset()

    def reset(self, seed=None, options=None):
        super().reset(seed=seed)
        
        self.current_step = self.window_size
        self.balance = self.initial_balance
        self.portfolio_value = self.initial_balance
        self.weights = np.ones(self.n_assets) / self.n_assets  # Evenly distributed initially
        self.history = [self.portfolio_value]
        
        return self._get_observation(), {}

    def _get_observation(self):
        # Flatten the historical returns of the past `window_size` days
        hist_returns = self.returns_data[self.current_step - self.window_size:self.current_step].flatten()
        
        # Combine historical returns, current weights, and scaled balance
        obs = np.concatenate([hist_returns, self.weights, [self.portfolio_value / self.initial_balance]])
        return obs.astype(np.float32)

    def step(self, action):
        # 1. Normalize actions to sum to 1 (Softmax can also be used outside the env)
        action = np.clip(action, 0, 1)
        if np.sum(action) > 0:
            new_weights = action / np.sum(action)
        else:
            new_weights = self.weights  # keep old weights if action is all zeros

        # 2. Calculate transaction costs for rebalancing
        weight_changes = np.abs(new_weights - self.weights)
        cost = np.sum(weight_changes) * self.transaction_cost * self.portfolio_value
        
        self.weights = new_weights
        
        # 3. Simulate market movement for the day
        daily_return = np.sum(self.weights * self.returns_data[self.current_step])
        
        # 4. Update portfolio value
        prev_portfolio_value = self.portfolio_value
        self.portfolio_value = (self.portfolio_value - cost) * (1 + daily_return)
        
        # 5. Calculate reward
        reward = (self.portfolio_value - prev_portfolio_value) / prev_portfolio_value  # Relative change (log return approx)
        
        self.current_step += 1
        self.history.append(self.portfolio_value)
        
        # Check termination
        terminated = self.current_step >= self.n_steps - 1
        truncated = self.portfolio_value < self.initial_balance * 0.1  # Ruined (Lost 90%)
        
        info = {
            'portfolio_value': self.portfolio_value,
            'daily_return': daily_return,
            'cost': cost
        }

        return self._get_observation(), reward, terminated, truncated, info

    def render(self):
        print(f"Step: {self.current_step} | Portfolio Value: ${self.portfolio_value:.2f}")

