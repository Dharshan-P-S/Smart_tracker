import React, { useState, useEffect } from 'react';
import axios from 'axios';
import styles from './SavingsPage.module.css';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const SavingsPage = () => {
  const [savingsData, setSavingsData] = useState([]); // Will store { month, savings, cumulativeSavings }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSavingsData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Simulate API delay for testing loading state
        // await new Promise(resolve => setTimeout(resolve, 1500));

        // Mock data for frontend testing if backend is not ready
        // const mockData = [
        //   { month: '2023-01-01', savings: 100 },
        //   { month: '2023-02-01', savings: 150 },
        //   { month: '2023-03-01', savings: 80 },
        //   { month: '2023-04-01', savings: 200 },
        //   { month: '2023-05-01', savings: -50 }, // Example of negative savings
        //   { month: '2023-06-01', savings: 120 },
        // ];
        // const data = mockData; // Use mock data

        const { data } = await axios.get('/api/transactions/savings/monthly');


        // Assuming data is sorted by month from backend
        // Calculate cumulative savings
        let cumulativeTotal = 0;
        const processedData = data.map(item => {
          const monthlySavings = parseFloat(item.savings) || 0; // Ensure savings is a number
          cumulativeTotal += monthlySavings;
          return {
            ...item,
            savings: monthlySavings,
            cumulativeSavings: cumulativeTotal,
          };
        });

        setSavingsData(processedData);
        setLoading(false);
      } catch (err) {
        setError('Failed to fetch savings data. Please ensure the backend is running and the endpoint is correct.');
        console.error(err);
        setLoading(false);
      }
    };

    fetchSavingsData();
  }, []);

  // Prepare data for the chart
  const chartData = savingsData.map(item => ({
    name: new Date(item.month).toLocaleString('default', { month: 'short', year: 'numeric' }),
    Savings: parseFloat(item.savings.toFixed(2)), // Ensure it's a number for the chart
    'Cumulative Savings': parseFloat(item.cumulativeSavings.toFixed(2)), // Add cumulative savings
  }));

  const renderGraph = () => {
    if (savingsData.length === 0 && !loading) {
      return <p className={styles.noDataText}>No savings data available to display chart.</p>;
    }
    return (
      <div className={styles.chartContainer}>
        <ResponsiveContainer width="100%" height={400}> {/* Specify a height */}
          <AreaChart
            data={chartData}
            margin={{
              top: 10, // Adjusted top margin
              right: 30,
              left: 20, // Increased left margin for Y-axis labels
              bottom: 20, // Increased bottom margin for legend if it's close
            }}
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
            <Area
              type="monotone"
              dataKey="Savings"
              stroke="#8884d8"
              fillOpacity={1}
              fill="url(#colorSavings)"
              dot={{ fill: '#8884d8', stroke: '#fff', strokeWidth: 1, r: 3 }} // Added dot prop
              activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }}          // Optional: style for active dot
            />
            <Area
              type="monotone"
              dataKey="Cumulative Savings"
              stroke="#82ca9d"
              fillOpacity={1}
              fill="url(#colorCumulative)"
              dot={{ fill: '#82ca9d', stroke: '#fff', strokeWidth: 1, r: 3 }} // Added dot prop
              activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }}          // Optional: style for active dot
            />
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
              <li key={index} className={styles.savingsListItem}>
                <div className={styles.monthYear}>
                  {new Date(item.month).toLocaleString('default', { month: 'long', year: 'numeric' })}:
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
          <p className={styles.noDataText}>No savings data available for the list.</p>
        )}
      </div>
    );
  };

  if (loading) return <div className={styles.savingsContainer}><p className={styles.loadingText}>Loading savings data...</p></div>;
  if (error && savingsData.length === 0) return <div className={styles.savingsContainer}><p className={styles.error}>{error}</p></div>;


  return (
    <div className={styles.savingsContainer}>
      <h2>Monthly Savings Analysis</h2>
      {error && <p className={styles.error}>{error}</p>} {/* Show error even if some data is loaded */}
      {renderGraph()}
      {renderSavingsList()}
    </div>
  );
};

export default SavingsPage;