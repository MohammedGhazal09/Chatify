import type { FC } from 'react';

const LoadingSpinner: FC = () => {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-green-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-green-400/5 rounded-full blur-3xl animate-pulse" style={{animationDelay: '2s'}}></div>
        <div className="absolute top-3/4 left-1/2 w-64 h-64 bg-green-600/5 rounded-full blur-3xl animate-pulse" style={{animationDelay: '4s'}}></div>
      </div>

      {/* Grid overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(rgba(34,197,94,0.03)_1px,transparent_1px)] [background-size:20px_20px]"></div>

      <div className="relative z-10 flex flex-col items-center gap-8">
        {/* Modern loading animation - Wave bars */}
        <div className="flex items-end space-x-2">
          <div className="w-3 h-8 bg-gradient-to-t from-green-600 to-green-400 rounded-full animate-pulse" style={{animationDuration: '0.6s'}}></div>
          <div className="w-3 h-12 bg-gradient-to-t from-green-500 to-green-300 rounded-full animate-pulse" style={{animationDuration: '0.8s', animationDelay: '0.1s'}}></div>
          <div className="w-3 h-6 bg-gradient-to-t from-green-400 to-green-200 rounded-full animate-pulse" style={{animationDuration: '0.7s', animationDelay: '0.2s'}}></div>
          <div className="w-3 h-10 bg-gradient-to-t from-green-600 to-green-400 rounded-full animate-pulse" style={{animationDuration: '0.9s', animationDelay: '0.3s'}}></div>
          <div className="w-3 h-4 bg-gradient-to-t from-green-500 to-green-300 rounded-full animate-pulse" style={{animationDuration: '0.6s', animationDelay: '0.4s'}}></div>
        </div>

        {/* Loading text with gradient and animation */}
        <div className="text-center space-y-3">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-green-400 to-green-600 bg-clip-text text-transparent">
            Loading
          </h2>
          <div className="flex items-center justify-center space-x-1">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-green-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
            <div className="w-2 h-2 bg-green-300 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
          </div>
          <p className="text-gray-400 text-sm animate-pulse">
            Preparing your experience...
          </p>
        </div>

        {/* Progress bar simulation */}
        <div className="w-64 h-1 bg-gray-800 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full animate-pulse"></div>
        </div>
      </div>

      {/* Floating decorative elements */}
      <div className="absolute top-20 left-20 w-2 h-2 bg-green-500/50 rounded-full animate-ping"></div>
      <div className="absolute bottom-32 right-16 w-1 h-1 bg-green-400/50 rounded-full animate-ping" style={{animationDelay: '1s'}}></div>
      <div className="absolute top-1/2 right-8 w-1.5 h-1.5 bg-green-300/50 rounded-full animate-ping" style={{animationDelay: '2s'}}></div>
      <div className="absolute bottom-20 left-1/4 w-1 h-1 bg-green-600/50 rounded-full animate-ping" style={{animationDelay: '3s'}}></div>
    </div>
  );
};

export default LoadingSpinner;