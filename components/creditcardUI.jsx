"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Upload, BarChart3, MessageSquare } from "lucide-react";
import { motion } from "framer-motion";
import { PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
const apiUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

export default function CreditCardAnalyzerUI() {
  const [file, setFile] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleAnalyze = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("http://localhost:8000/analyze", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (data.error) {
        setError(data.error);
        setAnalysis(null);
      } else {
        setAnalysis(data);
      }
    } catch (err) {
      setError("Server error. Please try again later.");
      setAnalysis(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-purple-100 p-20">
      <h1 className="text-5xl font-bold text-center mb-5">
        Credit Card Statement Analyzer
      </h1>

      <Card className="max-w-7xl mx-auto shadow-xl rounded-2xl">
        <CardContent className="p-6">
          <Tabs defaultValue="upload" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="upload"><Upload className="w-6 h-4" /> Upload</TabsTrigger>
              <TabsTrigger value="dashboard"><BarChart3 className="w-4 h-4" /> Dashboard</TabsTrigger>
              <TabsTrigger value="assistant"><MessageSquare className="w-4 h-4" /> Assistant</TabsTrigger>
            </TabsList>

            {/* Upload Section */}
            <TabsContent value="upload">
              <motion.div className="border-2 border-dashed rounded-2xl p-8 text-center bg-white">
                <Input type="file" accept=".pdf" onChange={(e) => setFile(e.target.files[0])} />
                {file && <p className="mt-2 font-medium">File: {file.name}</p>}
                <Button onClick={handleAnalyze} disabled={loading} className="mt-4">
                  {loading ? "Analyzing..." : "Analyze"}
                </Button>
                {error && <p className="mt-4 text-red-600">{error}</p>}
              </motion.div>
            </TabsContent>

            {/* Dashboard Section */}
            <TabsContent value="dashboard">
              {analysis ? (
                <div className="grid gap-6">
                  <Card className="p-4 shadow-md">
                    <h2 className="font-semibold mb-2">Total Spending</h2>
                    <p className="text-xl font-bold">${analysis.total_spent}</p>
                  </Card>

                  <Card className="p-4 shadow-md">
                    <h2 className="font-semibold mb-2">Spending Categories</h2>
                    {analysis.summary && (
                      <PieChart width={400} height={400}>
                        <Pie
                          data={Object.entries(analysis.summary).map(([name, value]) => ({ name, value }))}
                          outerRadius={100}
                          dataKey="value"
                          label
                        >
                          {Object.entries(analysis.summary).map(([_, v], i) => (
                            <Cell key={i} fill={[
                              "#82ca9d", "#8884d8", "#ffc658", "#ff7f50", 
                              "#a29bfe", "#dcdcdc", "#ffb6c1", "#98d8c8",
                              "#f7dc6f", "#bb8fce", "#85c1e9", "#f8c471",
                              "#82e0aa", "#f1948a", "#85c1e9", "#d7bde2",
                              "#aed6f1", "#f9e79f", "#d5dbdb", "#fadbd8"
                            ][i % 20]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    )}
                  </Card>

                  <Card className="p-4 shadow-md">
                    <h2 className="font-semibold mb-2">Transactions</h2>
                    {analysis.transactions?.length ? (
                      <table className="min-w-full border text-sm">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="px-2 py-1 border">Date</th>
                            <th className="px-2 py-1 border">Post Date</th>
                            <th className="px-2 py-1 border">Merchant</th>
                            <th className="px-2 py-1 border">Amount</th>
                            <th className="px-2 py-1 border">Category</th>
                          </tr>
                        </thead>
                        <tbody>
                          {analysis.transactions.map((t, i) => (
                            <tr key={i}>
                              <td className="border px-2 py-1">{t.date}</td>
                              <td className="border px-2 py-1">{t.post_date || "-"}</td>
                              <td className="border px-2 py-1">{t.merchant}</td>
                              <td className="border px-2 py-1">${t.amount}</td>
                              <td className="border px-2 py-1">{t.category}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <p>No transactions found.</p>
                    )}
                  </Card>
                </div>
              ) : (
                <p>No analysis yet. Upload a PDF to get started.</p>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
