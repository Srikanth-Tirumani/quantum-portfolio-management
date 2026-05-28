import torch
import torch.nn as nn
import pennylane as qml

class HybridQuantumActor(nn.Module):
    """
    Variational Quantum Circuit (VQC) integrated with PyTorch.
    Acts as the 'Actor' in an Actor-Critic architecture by deciding portfolio weights.
    """
    def __init__(self, obs_dim, n_assets, n_qubits=4, n_layers=2):
        super(HybridQuantumActor, self).__init__()
        self.n_qubits = n_qubits
        self.n_layers = n_layers
        
        # Classical pre-processing: project observation down to n_qubits features
        self.pre_net = nn.Linear(obs_dim, n_qubits)
        
        # PennyLane quantum device (simulator)
        self.dev = qml.device("default.qubit", wires=n_qubits)
        
        # Define the quantum node
        @qml.qnode(self.dev, interface="torch")
        def vqc_circuit(inputs, weights):
            # 1. State Preparation (Encoding classical data into quantum state)
            qml.AngleEmbedding(inputs, wires=range(self.n_qubits))
            
            # 2. Parameterized Quantum Circuit (PQC) - The trainable part
            qml.StronglyEntanglingLayers(weights, wires=range(self.n_qubits))
            
            # 3. Measurement (Expectation value of PauliZ for each qubit)
            return [qml.expval(qml.PauliZ(i)) for i in range(self.n_qubits)]

        # Wrap QNode in a Torch layer to make its parameters automatically differentiable
        weight_shapes = {"weights": (n_layers, n_qubits, 3)}
        self.q_layer = qml.qnn.TorchLayer(vqc_circuit, weight_shapes)
        
        # Classical post-processing: Map quantum outputs to action space (assets)
        self.post_net = nn.Sequential(
            nn.Linear(n_qubits, n_assets),
            nn.Softmax(dim=-1) # Portfolio weights must sum to 1
        )

    def forward(self, x):
        # Scale inputs for Angle Embedding (between 0 and 2*pi)
        x = torch.sigmoid(self.pre_net(x)) * 3.14159
        
        # Pass through Quantum Layer
        q_out = self.q_layer(x)
        
        # Produce portfolio weights
        actions = self.post_net(q_out)
        return actions

def get_quantum_actor(obs_dim, n_assets):
    """Factory function for the VQC Actor."""
    print("Initializing Hybrid Quantum VQC...")
    model = HybridQuantumActor(obs_dim, n_assets)
    return model
