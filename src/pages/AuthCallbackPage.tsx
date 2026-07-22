import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const processCallback = async () => {
      try {
        if (!supabase) {
          throw new Error('Supabase is not configured.');
        }

        // Supabase handles the auth state change automatically when the link is clicked
        // The onAuthStateChange listener in AuthContext will detect the session
        // Just wait a moment for the auth state to update
        await new Promise((resolve) => setTimeout(resolve, 1500));

        if (isMounted) {
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();
          
          if (sessionError) {
            throw sessionError;
          }

          if (session) {
            // Session is now active, redirect to dashboard
            navigate('/', { replace: true });
          } else {
            // No session yet, something went wrong
            throw new Error('Authentication failed: No session established.');
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Authentication failed. Please try again.');
          console.error('Auth callback error:', err);
          setTimeout(() => {
            navigate('/login', { replace: true });
          }, 3000);
        }
      } finally {
        if (isMounted) {
          setIsProcessing(false);
        }
      }
    };

    processCallback();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  return (
    <div className="grid min-h-screen place-items-center bg-slate-950 px-4">
      <div className="text-center">
        {isProcessing ? (
          <>
            <div className="inline-block animate-spin mb-4">
              <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full" />
            </div>
            <p className="text-slate-300">Processing your invitation...</p>
          </>
        ) : error ? (
          <>
            <p className="text-red-400 mb-4">{error}</p>
            <p className="text-slate-400 text-sm">Redirecting to login...</p>
          </>
        ) : null}
      </div>
    </div>
  );
}
