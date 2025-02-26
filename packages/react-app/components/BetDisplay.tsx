import React, { useState } from 'react';
import { formatTokenAmount, formatAddress } from '../utils/format';
import { ethers } from 'ethers';
import { useWeb3 } from '../contexts/useWeb3';

interface BetDisplayProps {
  bet: {
    id: string;
    creator: string;
    opponent: string;
    amount: string;
    opponentStake: string;
    condition: string;
    creatorOutcome: boolean | null;
    opponentOutcome: boolean | null;
    resolved: boolean;
    expirationTime: number;
    status: 'Created' | 'Active' | 'Completed' | 'Cancelled';
  };
  onJoin: () => void;
  onBetUpdated?: () => void;
  isLoading?: boolean;
}

const BetDisplay: React.FC<BetDisplayProps> = ({ bet, onJoin, onBetUpdated, isLoading = false }) => {
  const { address, submitOutcome, resolveBet, mintCELO, getCELOBalance } = useWeb3();
  const [selectedOutcome, setSelectedOutcome] = useState<boolean | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mintSuccess, setMintSuccess] = useState(false);
  
  const isActive = bet.status === 'Active';
  const canJoin = bet.status === 'Created' && bet.opponent === ethers.ZeroAddress;
  const timeLeft = Math.max(0, bet.expirationTime - Math.floor(Date.now() / 1000));
  
  const isCreator = address?.toLowerCase() === bet.creator.toLowerCase();
  const isOpponent = address?.toLowerCase() === bet.opponent.toLowerCase();
  const isParticipant = isCreator || isOpponent;
  
  const canSubmitOutcome = isParticipant && isActive && !bet.resolved;
  const hasSubmittedOutcome = isCreator ? bet.creatorOutcome !== null : isOpponent ? bet.opponentOutcome !== null : false;
  
  const canResolve = isParticipant && isActive && !bet.resolved && 
                    bet.creatorOutcome !== null && bet.opponentOutcome !== null && 
                    bet.creatorOutcome === bet.opponentOutcome;
  
  const formatTimeLeft = () => {
    const days = Math.floor(timeLeft / (24 * 60 * 60));
    const hours = Math.floor((timeLeft % (24 * 60 * 60)) / (60 * 60));
    if (days > 0) return `${days}d ${hours}h`;
    const minutes = Math.floor((timeLeft % (60 * 60)) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const handleSubmitOutcome = async () => {
    if (selectedOutcome === null) {
      setError("Please select an outcome");
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      const tx = await submitOutcome(bet.id, selectedOutcome);
      await tx.wait();
      // Notify parent component to refresh data
      if (onBetUpdated) {
        onBetUpdated();
      }
    } catch (err: any) {
      console.error("Error submitting outcome:", err);
      
      // Handle specific error messages
      if (err.message.includes('user rejected')) {
        setError('You rejected the transaction. Please confirm the transaction in your wallet to submit the outcome.');
      } else if (err.message.includes('Could not connect to local Hardhat node')) {
        setError('Could not connect to local Hardhat node. Please make sure it is running with "npx hardhat node".');
      } else {
        setError(err.message || "Failed to submit outcome");
      }
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleResolveBet = async () => {
    setIsResolving(true);
    setError(null);
    
    try {
      const tx = await resolveBet(bet.id);
      await tx.wait();
      // Notify parent component to refresh data
      if (onBetUpdated) {
        onBetUpdated();
      }
    } catch (err: any) {
      console.error("Error resolving bet:", err);
      
      // Handle specific error messages
      if (err.message.includes('user rejected')) {
        setError('You rejected the transaction. Please confirm the transaction in your wallet to resolve the bet.');
      } else if (err.message.includes('Could not connect to local Hardhat node')) {
        setError('Could not connect to local Hardhat node. Please make sure it is running with "npx hardhat node".');
      } else {
        setError(err.message || "Failed to resolve bet");
      }
    } finally {
      setIsResolving(false);
    }
  };

  const handleMintCELO = async () => {
    if (!address) return;
    
    setIsMinting(true);
    setError(null);
    setMintSuccess(false);
    
    try {
      // Mint enough CELO tokens to join the bet (add a little extra for gas)
      const amountToMint = (parseFloat(ethers.formatEther(bet.opponentStake)) + 10).toString();
      await mintCELO(amountToMint);
      setMintSuccess(true);
      
      // Hide success message after 5 seconds
      setTimeout(() => {
        setMintSuccess(false);
      }, 5000);
    } catch (err: any) {
      console.error('Error minting CELO:', err);
      setError(err.message || 'Failed to mint CELO tokens. Please try again.');
    } finally {
      setIsMinting(false);
    }
  };

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium bg-gray-100 px-2 py-1 rounded-full text-gray-600">#{bet.id}</span>
            <h3 className="font-medium">{bet.condition}</h3>
          </div>
          <p className="text-sm text-gray-500">Created by {formatAddress(bet.creator)}</p>
        </div>
        <span className={`px-2 py-1 rounded-full text-xs ${
          bet.status === 'Created' ? 'bg-blue-100 text-blue-800' :
          bet.status === 'Active' ? 'bg-green-100 text-green-800' :
          bet.status === 'Completed' ? 'bg-gray-100 text-gray-800' :
          'bg-red-100 text-red-800'
        }`}>
          {bet.status}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-gray-500">Creator Stake</p>
          <p className="font-medium">{formatTokenAmount(bet.amount, 'CELO')} <span className="text-xs text-gray-500">(Fixed for MVP)</span></p>
        </div>
        <div>
          <p className="text-gray-500">Opponent Stake</p>
          <p className="font-medium">
            {bet.opponent && bet.opponent !== ethers.ZeroAddress 
              ? formatTokenAmount(bet.opponentStake, 'CELO')
              : '0.00 CELO'}
            {parseFloat(bet.opponentStake) < 100 && bet.opponent !== ethers.ZeroAddress && 
              <span className="text-xs text-amber-500 ml-1">(Min: 100 CELO)</span>}
          </p>
        </div>
        <div>
          <p className="text-gray-500">Creator</p>
          <p className="font-medium">{formatAddress(bet.creator)}</p>
        </div>
        <div>
          <p className="text-gray-500">Opponent</p>
          <p className="font-medium">
            {bet.opponent && bet.opponent !== ethers.ZeroAddress 
              ? formatAddress(bet.opponent) 
              : 'None yet'}
          </p>
        </div>
        <div>
          <p className="text-gray-500">Status</p>
          <p className="font-medium">
            {bet.resolved 
              ? 'Resolved' 
              : bet.opponent !== ethers.ZeroAddress 
                ? 'Active' 
                : 'Waiting for opponent'}
          </p>
        </div>
        <div>
          <p className="text-gray-500">Expires In</p>
          <p className="font-medium">{timeLeft > 0 ? formatTimeLeft() : 'Expired'}</p>
        </div>
      </div>

      {canJoin && (
        <button
          onClick={onJoin}
          disabled={isLoading}
          className="w-full mt-3 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark transition-colors disabled:bg-gray-300"
        >
          {isLoading ? (
            <div className="flex items-center justify-center">
              <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full mr-2"></div>
              <span>Joining...</span>
            </div>
          ) : (
            'Join Bet'
          )}
        </button>
      )}

      {/* Outcome submission section */}
      {canSubmitOutcome && !hasSubmittedOutcome && (
        <div className="mt-4 p-3 bg-blue-50 rounded-md">
          <p className="text-sm font-medium mb-2">Submit your outcome:</p>
          
          {error && (
            <div className="mb-2 text-sm text-red-600">
              {error}
            </div>
          )}
          
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => setSelectedOutcome(true)}
              className={`flex-1 py-2 px-3 rounded-md ${
                selectedOutcome === true 
                  ? 'bg-green-500 text-white' 
                  : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              Yes
            </button>
            <button
              onClick={() => setSelectedOutcome(false)}
              className={`flex-1 py-2 px-3 rounded-md ${
                selectedOutcome === false 
                  ? 'bg-red-500 text-white' 
                  : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              No
            </button>
          </div>
          
          <button
            onClick={handleSubmitOutcome}
            disabled={selectedOutcome === null || isSubmitting}
            className="w-full py-2 bg-primary text-white rounded-md hover:bg-primary-dark disabled:bg-gray-300"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Outcome'}
          </button>
        </div>
      )}
      
      {/* Resolve bet section */}
      {canResolve && (
        <div className="mt-4 p-3 bg-green-50 rounded-md">
          <p className="text-sm font-medium mb-2">Both parties agree on the outcome!</p>
          
          {error && (
            <div className="mb-2 text-sm text-red-600">
              {error}
            </div>
          )}
          
          <button
            onClick={handleResolveBet}
            disabled={isResolving}
            className="w-full py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-300"
          >
            {isResolving ? 'Resolving...' : 'Resolve Bet & Claim Rewards'}
          </button>
        </div>
      )}

      {/* Outcome display section */}
      {(bet.creatorOutcome !== null || bet.opponentOutcome !== null) && (
        <div className="mt-3 p-3 bg-gray-50 rounded-md">
          <p className="text-sm font-medium">Outcome:</p>
          <div className="flex justify-between mt-1">
            <span className="text-sm">
              Creator: {bet.creatorOutcome === null ? 'Not submitted' : bet.creatorOutcome ? 'Yes' : 'No'}
            </span>
            <span className="text-sm">
              Opponent: {bet.opponentOutcome === null ? 'Not submitted' : bet.opponentOutcome ? 'Yes' : 'No'}
            </span>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 text-red-500 p-4 rounded-md mb-4">
          {error}
          {error.includes('Insufficient CELO balance') && (
            <div className="mt-2">
              <button
                onClick={handleMintCELO}
                disabled={isMinting}
                className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark disabled:bg-gray-400"
              >
                {isMinting ? 'Minting...' : `Mint CELO Tokens to Join`}
              </button>
            </div>
          )}
        </div>
      )}
      
      {mintSuccess && (
        <div className="bg-green-50 text-green-600 p-4 rounded-md mb-4">
          CELO tokens minted successfully! You can now join the bet.
        </div>
      )}
    </div>
  );
};

export default BetDisplay;
