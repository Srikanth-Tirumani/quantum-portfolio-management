# Quantum Reinforcement Learning for Portfolio Management

This project demonstrates the application of Hybrid Quantum-Classical Reinforcement Learning to financial portfolio optimization.

## Overview
The system learns to distribute capital across a set of assets (e.g., AAPL, MSFT, GOOGL, JPM) to maximize returns while managing risk. It implements a custom OpenAI Gymnasium environment to simulate historical market movements using data fetched from Yahoo Finance.

We compare two approaches:
1. **Classical Baseline**: A standard Deep Reinforcement Learning agent using Proximal Policy Optimization (PPO) via `stable-baselines3`.
2. **Quantum AI Agent**: A Hybrid Actor-Critic model featuring a Variational Quantum Circuit (VQC) implemented using PyTorch and PennyLane.

## Architecture
- `src/data_fetcher.py`: Connects to `yfinance` to download historical market data.
- `src/portfolio_env.py`: Custom `gymnasium` trading environment.
- `src/classical_agent.py`: PPO Baseline implementation.
- `src/quantum_agent.py`: Hybrid Quantum Neural Network (QNN) Actor.
- `src/evaluate.py`: Backtesting and performance plotting tools.
- `main.py`: Entrypoint to fetch data, train agents, and evaluate performance.

## Installation

1. Clone this repository.
2. Initialize a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

## Usage

Simply run the main script to start the data download, training, and evaluation pipelines:

```bash
python main.py
```

The script will produce PNG charts in the root directory comparing the Classical PPO vs. Quantum VQC Agent's portfolio performance over the test dataset.

## Research Value
This project highlights the potential of Quantum Computing in complex financial optimizations, an emerging advanced research field in FinTech.
