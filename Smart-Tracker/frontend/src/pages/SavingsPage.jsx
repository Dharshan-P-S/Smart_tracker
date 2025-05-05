import React, { useState, useEffect } from 'react';
import axios from 'axios';
import styles from './SavingsPage.module.css';
// Assuming you have a charting library like Chart.js or Recharts installed
// import { Line } from 'react-chartjs-2'; // Example for Chart.js
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'; // Import AreaChart and Area

const SavingsPage = () => {
  const [savingsData, setSavingsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSavingsData = async () => {
      setLoading(true); // Set loading true at the start
      setError(null); // Reset error state
      try {
        // Fetch data from the backend endpoint
        const { data } = await axios.get('/api/transactions/savings/monthly');

        // Data is already sorted by the backend, no need to sort here
        // data.sort((a, b) => new Date(a.month) - new Date(b.month)); // Remove sorting

        setSavingsData(data);
        setLoading(false);
      } catch (err) {
        setError('Failed to fetch savings data. Please ensure the backend is running and the endpoint is correct.');
        console.error(err);
        setLoading(false);
      }
    };

    fetchSavingsData();
  }, []);

  // Prepare data for the chart (example using Recharts)
  const chartData = savingsData.map(item => ({
    name: new Date(item.month).toLocaleString('default', { month: 'short', year: 'numeric' }), // Format month name
    Savings: item.savings,
  }));

  const renderGraph = () => {
    return (
      <div className={styles.chartContainer}> {/* Use the new container class */}
        <ResponsiveContainer width="100%" height="100%"> {/* Use 100% height */}
          <AreaChart
            data={chartData}
            margin={{
              top: 5,
              right: 30,
              left: 20,
              bottom: 5,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Area type="monotone" dataKey="Savings" stroke="#8884d8" fill="#8884d8" fillOpacity={0.3} /> {/* Use Area component with fill */}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  };

  const renderSavingsList = () => {
    return (
      <div className={styles.savingsList}>
        <h3>Monthly Savings Breakdown</h3>
        {savingsData.length > 0 ? (
          <ul>
            {savingsData.map((item, index) => (
              <li key={index}>
                {new Date(item.month).toLocaleString('default', { month: 'long', year: 'numeric' })}:
                <span className={item.savings >= 0 ? styles.positive : styles.negative}>
                   ₹{item.savings.toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p>No savings data available.</p>
        )}
      </div>
    );
  };

  if (loading) return <p>Loading savings data...</p>;
  if (error) return <p className={styles.error}>{error}</p>;

  return (
    <div className={styles.savingsContainer}>
      <h2>Monthly Savings Analysis</h2>
      {renderGraph()}
      {renderSavingsList()}
    </div>
  );
};

export default SavingsPage;
