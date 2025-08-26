import { useAuth } from '../../hooks/useAuth';
import AccountsButton from '../../components/accountsButton';

const Home = () => {
  const { user, logout, isLoading } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <div className="min-h-screen bg-[#d3e2f1] p-8">
      <div className="max-w-4xl mx-auto">
        <header className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-black mb-2">
                Welcome to Chatify
              </h1>
              {user && (
                <p className="text-xl text-gray-600">
                  Hello, {user.firstName} {user.lastName}!
                </p>
              )}
            </div>
            <div className="flex items-center gap-4">
              {user?.profilePic && (
                <img 
                  src={user.profilePic} 
                  alt="Profile" 
                  className="w-12 h-12 rounded-full"
                />
              )}
              <div onClick={handleLogout}>
                <AccountsButton
                  color="#dc2626"
                  text={isLoading ? 'Logging out...' : 'Logout'}
                  disabled={isLoading}
                />
              </div>
            </div>
          </div>
        </header>

        <main className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold text-black mb-4">Your Dashboard</h2>
          <p className="text-gray-600 text-lg">
            You are now logged in and can access all features of Chatify.
          </p>
          
          {/* Add your chat components and functionality here */}
          <div className="mt-8 p-6 bg-gray-50 rounded-lg">
            <h3 className="text-xl font-semibold text-black mb-2">
              User Information
            </h3>
            {user && (
              <div className="space-y-2">
                <p className="text-gray-600"><strong>Email:</strong> {user.email}</p>
                <p className="text-gray-600"><strong>Full Name:</strong> {user.firstName} {user.lastName}</p>
                <p className="text-gray-600"><strong>User ID:</strong> {user._id}</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Home;