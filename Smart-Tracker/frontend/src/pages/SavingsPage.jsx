// SavingsPage.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import styles from './SavingsPage.module.css';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const SavingsPage = () => {
  const [savingsData, setSavingsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSavingsData = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = localStorage.getItem('authToken'); // <<< GET THE TOKEN

        if (!token) { // <<< CHECK IF TOKEN EXISTS
          setError('Authentication token not found. Please log in.');
          setLoading(false);
          return;
        }

        // Make sure your API base URL is configured if not hitting the same domain/port
        // For Vite, if proxy is set in vite.config.js, '/api/...' should work.
        // Otherwise, use full URL e.g., 'http://localhost:5000/api/transactions/savings/monthly'
        const { data } = await axios.get('/api/transactions/savings/monthly', {
          headers: { // <<< ADD HEADERS
            'Authorization': `Bearer ${token}`
          }
        });

        let cumulativeTotal = 0;
        const processedData = data.map(item => {
          const monthlySavings = parseFloat(item.savings) || 0;
          cumulativeTotal += monthlySavings;
          return {
            ...item,
            savings: monthlySavings,
            cumulativeSavings: cumulativeTotal,
          };
        });

        setSavingsData(processedData);
      } catch (err) {
        if (err.response && err.response.status === 401) {
          setError('Unauthorized: Your session may have expired. Please log in again.');
        } else {
          setError('Failed to fetch savings data. Please try again later.');
        }
        console.error("Error fetching savings data:", err.response?.data || err.message, err);
        setSavingsData([]); // Clear data on error
      } finally {
        setLoading(false);
      }
    };

    fetchSavingsData();
  }, []); // Empty dependency array means this runs once on mount

  // ... (rest of your component is likely fine if the data fetching works)

  // Prepare data for the chart
  const chartData = savingsData.map(item => ({
    name: new Date(item.month + 'T00:00:00Z').toLocaleDateString('default', { month: 'short', year: 'numeric', timeZone: 'UTC' }), // Ensure date is parsed as UTC if it's YYYY-MM
    Savings: parseFloat(item.savings.toFixed(2)),
    'Cumulative Savings': parseFloat(item.cumulativeSavings.toFixed(2)),
  }));

  const renderGraph = () => {
    if (savingsData.length === 0 && !loading && !error) { // Added !error condition
      return <p className={styles.noDataText}>No savings data available to display chart.</p>;
    }
    // Don't render graph if there's an error and no data, let the main error message handle it.
    if (savingsData.length === 0 && error) {
        return null;
    }
    return (
      <div className={styles.chartContainer}>
        <ResponsiveContainer width="100%" height={400}>
          <AreaChart
            data={chartData}
            margin={{ top: 10, right: 30, left: 20, bottom: 20 }}
          >
            <defs>
              <linearGradient id="colorSavings" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#8884d8" stopOpacity={0.1}/>
              </linearGradient>
              <linearGradient id="colorCumulative" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#82ca9d" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#82ca9d" stopOpacity={0.1}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#ccc" />
            <XAxis dataKey="name" stroke="#666" />
            <YAxis stroke="#666" tickFormatter={(value) => `₹${value}`} />
            <Tooltip
              formatter={(value, name) => [`₹${Number(value).toFixed(2)}`, name]}
              contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', border: '1px solid #ccc', borderRadius: '5px' }}
              cursor={{ fill: 'rgba(204,204,204,0.2)' }}
            />
            <Legend wrapperStyle={{ paddingTop: '20px' }}/>
            <Area type="monotone" dataKey="Savings" stroke="#8884d8" fillOpacity={1} fill="url(#colorSavings)" dot={{ fill: '#8884d8', stroke: '#fff', strokeWidth: 1, r: 3 }} activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }} />
            <Area type="monotone" dataKey="Cumulative Savings" stroke="#82ca9d" fillOpacity={1} fill="url(#colorCumulative)" dot={{ fill: '#82ca9d', stroke: '#fff', strokeWidth: 1, r: 3 }} activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  };

  const renderSavingsList = () => {
    // Don't render list if there's an error and no data
    if (savingsData.length === 0 && error) {
        return null;
    }
    return (
      <div className={styles.savingsList}>
        <h3>Monthly Savings Breakdown</h3>
        {savingsData.length > 0 ? (
          <ul>
            {savingsData.map((item, index) => (
              <li key={index} className={styles.savingsListItem}>
                <div className={styles.monthYear}>
                  {/* Assuming item.month is "YYYY-MM", append day for proper UTC parsing if needed */}
                  {new Date(item.month + '-01T00:00:00Z').toLocaleDateString('default', { month: 'long', year: 'numeric', timeZone: 'UTC' })}:
                </div>
                <div className={styles.savingsAmounts}>
                  <span className={styles.label}>Monthly: </span>
                  <span className={item.savings >= 0 ? styles.positive : styles.negative}>
                     ₹{item.savings.toFixed(2)}
                  </span>
                  <span className={styles.separator}> | </span>
                  <span className={styles.label}>Total Saving till this month: </span>
                  <span className={item.cumulativeSavings >= 0 ? styles.positive : styles.negative}>
                     ₹{item.cumulativeSavings.toFixed(2)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          !loading && !error && <p className={styles.noDataText}>No savings data available for the list.</p> // Show only if no loading and no error
        )}
      </div>
    );
  };

  // Main loading/error display
  if (loading) return <div className={styles.savingsContainer}><p className={styles.loadingText}>Loading savings data...</p></div>;
  // If there's an error and no data could be fetched (e.g., initial 401)
  if (error && savingsData.length === 0) return <div className={styles.savingsContainer}><p className={styles.error}>{error}</p></div>;
  // If no data and no error (empty successful response)
  if (!loading && savingsData.length === 0 && !error) {
    return (
      <div className={styles.savingsContainer}>
        <h2>Monthly Savings Analysis</h2>
        <p className={styles.noDataText}>You have no savings data yet. Start by adding some income and expenses!</p>
      </div>
    );
  }

  return (
    <div className={styles.savingsContainer}>
      <h2>Monthly Savings Analysis</h2>
      {/* Display error at top if it occurred but some stale data might still be shown (less likely with current logic) */}
      {error && <p className={styles.error}>{error}</p>}
      {renderGraph()}
      {renderSavingsList()}
    </div>
  );
};

export default SavingsPage;