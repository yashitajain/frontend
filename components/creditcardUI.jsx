"use client";

import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Upload, BarChart3, MessageSquare, FileDown } from "lucide-react";
import { motion } from "framer-motion";

import {
  PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";

const apiUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

export default function CreditCardAnalyzerUI() {
  const [files, setFiles] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [filteredTx, setFilteredTx] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [deepDiveCategory, setDeepDiveCategory] = useState(null);


  const formatCurrency = (value) =>
    `$${Number(value).toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })}`;
  
  const allCategories = analysis
  ? ["All", ...Array.from(new Set(analysis.combined.all_transactions.map((t) => t.category)))]
  : ["All"];

  const onFilesChange = (e) => {
    setFiles(Array.from(e.target.files || []));
  };
  const aggregates = analysis?.combined?.aggregates;

const avgMonthlySpend = aggregates?.avg_monthly_spend ?? 0;
const discretionarySpend = aggregates?.discretionary_spent ?? 0;

const topCategory = aggregates?.category_spend
  ? Object.entries(aggregates.category_spend)
      .sort((a, b) => b[1] - a[1])[0]?.[0]
  : "—";

const activeCards = aggregates?.card_spend
  ? Object.keys(aggregates.card_spend).length
  : 0;


  const handleAnalyze = async () => {
    if (!files.length) return;

    setLoading(true);
    setError(null);
    setAnalysis(null);

    try {
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));

      const res = await fetch(`${apiUrl}/analyze`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (data.detail) {
        setError(data.detail);
      } else {

        // Add inferred year for each transaction based on statement
        const allTxWithYear = data.combined.all_transactions.map(t => {
          // statementYear should come from your backend analysis of the PDF
          const statementYear = t.statement_year || new Date().getFullYear();
          const [month, day] = t.date.split("/").map(Number);
          return {
            ...t,
            date: `${statementYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
          };
        });

        data.combined.all_transactions = allTxWithYear;
        setAnalysis(data);
        setFilteredTx(allTxWithYear);
      }
    } catch (e) {
      setError("Server error — try again.");
    } finally {
      setLoading(false);
    }
  };

  const categorySummary =
    analysis?.combined?.aggregates?.category_summary_percent || {};
  const monthlySummary =
    analysis?.combined?.aggregates?.monthly_spending || {};
  
  const filteredMonthly = analysis
    ? analysis.combined.all_transactions
        .filter(t => selectedCategory === "All" || t.category === selectedCategory)
        .reduce((acc, t) => {
          const month = t.date.slice(0, 7); // YYYY-MM
          acc[month] = (acc[month] || 0) + t.amount;
          return acc;
        }, {})
    : {};
    
  const monthlyData = Object.entries(filteredMonthly)
    .map(([month, amount]) => ({ month, amount }))
    .sort((a,b) => new Date(a.month + "-01") - new Date(b.month + "-01"));
  
  const monthlyStackedData = useMemo(() => {
      if (!analysis) return [];
    
      const acc = {};
    
      analysis.combined.all_transactions
        .filter(
          (t) => selectedCategory === "All" || t.category === selectedCategory
        )
        .forEach((t) => {
          const month = t.date.slice(0, 7); // YYYY-MM
    
          if (!acc[month]) acc[month] = { month };
    
          acc[month][t.category] =
            (acc[month][t.category] || 0) + t.amount;
        });
    
      return Object.values(acc).sort(
        (a, b) => new Date(a.month + "-01") - new Date(b.month + "-01")
      );
    }, [analysis, selectedCategory]);
    
  const categoryTx = useMemo(() => {
      if (!analysis || !deepDiveCategory) return [];
    
      return analysis.combined.all_transactions.filter(
        (t) => t.category === deepDiveCategory && t.amount > 0
      );
    }, [analysis, deepDiveCategory]);
  
  const categoryMonthlyTrend = useMemo(() => {
      const acc = {};
    
      categoryTx.forEach((t) => {
        const month = t.date.slice(0, 7);
        acc[month] = (acc[month] || 0) + t.amount;
      });
    
      return Object.entries(acc)
        .map(([month, amount]) => ({ month, amount }))
        .sort((a, b) => new Date(a.month) - new Date(b.month));
    }, [categoryTx]);

  const categoryStats = useMemo(() => {
      if (!categoryTx.length) return null;
    
      const total = categoryTx.reduce((s, t) => s + t.amount, 0);
      const months = new Set(categoryTx.map((t) => t.date.slice(0, 7)));
    
      return {
        total,
        avgMonthly: total / months.size,
        transactions: categoryTx.length,
      };
    }, [categoryTx]);
        
  const categoryMerchants = useMemo(() => {
      const map = {};
    
      categoryTx.forEach((t) => {
        if (!map[t.merchant]) {
          map[t.merchant] = { merchant: t.merchant, total: 0, count: 0 };
        }
        map[t.merchant].total += t.amount;
        map[t.merchant].count += 1;
      });
    
      return Object.values(map)
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);
    }, [categoryTx]);
        
  const stackCategories = useMemo(() => {
      if (!analysis) return [];
    
      if (selectedCategory !== "All") {
        return [selectedCategory];
      }
    
      return Array.from(
        new Set(analysis.combined.all_transactions.map(t => t.category))
      );
    }, [analysis, selectedCategory]);
    
  const merchantStats = useMemo(() => {
      if (!analysis) return [];
    
      const map = {};
    
      analysis.combined.all_transactions.forEach((t) => {
        const merchant = t.merchant || "Unknown";
        const amt = Number(t.amount) || 0;
    
        if (amt <= 0) return;
    
        if (!map[merchant]) {
          map[merchant] = {
            merchant,
            total: 0,
            count: 0,
          };
        }
    
        map[merchant].total += amt;
        map[merchant].count += 1;
      });
    
      return Object.values(map)
        .sort((a, b) => b.total - a.total)
        .slice(0, 15); // top 15 merchants
    }, [analysis]);
    

    

  const chartColors = [
    "#82ca9d", "#191970", "#ffc658", "#ff7f50",
    "#006400", "#FF0000", "#55efc4", "#FF0000", "#C11C84","#301934"
  ];

  const handleSearch = (e) => {
    const q = e.target.value.toLowerCase();
    setSearch(q);

    const allTx = analysis?.combined?.all_transactions ?? [];
    const filtered = allTx.filter(
      (t) =>
        t?.merchant?.toLowerCase().includes(q) ||
        t?.category?.toLowerCase().includes(q)
    );
    setFilteredTx(filtered);
  };

  const downloadExcel = async () => {
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));

    const res = await fetch(`${apiUrl}/export/excel`, {
      method: "POST",
      body: formData,
    });

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "transactions.xlsx";
    a.click();
  };

  const downloadCSV = async () => {
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));

    const res = await fetch(`${apiUrl}/export/csv`, {
      method: "POST",
      body: formData,
    });

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "transactions.csv";
    a.click();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-10">
      <h1 className="text-5xl font-extrabold text-center mb-10">
        💳 Smart Credit Card Analyzer
      </h1>
      <h3 className="text-4xl font-extrabold text-center mb-4">
  Ever wonder where your money actually goes?
</h3>

<p className="text-center text-gray-600 mb-8">
  Coffee runs, food delivery, subscriptions — it adds up faster than you think. <br/>
  We analyze spending, detect patterns, and surface insights you can act on.
</p>

      <div className="max-w-7xl mx-auto">
        <Card>
          <CardContent className="p-8">
            <Tabs defaultValue="upload">
              <TabsList className="grid grid-cols-3 mb-6">
                <TabsTrigger value="upload">
                  <Upload className="w-4 h-4 mr-1" /> Upload
                </TabsTrigger>
                <TabsTrigger value="dashboard">
                  <BarChart3 className="w-4 h-4 mr-1" /> Dashboard
                </TabsTrigger>
                <TabsTrigger value="assistant">
                  <MessageSquare className="w-4 h-4 mr-1" /> Assistant
                </TabsTrigger>
              </TabsList>

              {/* ------------ UPLOAD TAB ------------ */}
              <TabsContent value="upload">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="border-2 border-dashed rounded-xl p-6 bg-white text-center"
                >
                  <Input
                    type="file"
                    accept=".pdf"
                    multiple
                    onChange={onFilesChange}
                  />
                  {files.length > 0 && (
                    <p className="mt-3 text-lg text-green-600">
                      {files.length} file(s) selected
                    </p>
                  )}
                  <div className="mt-4 text-xs text-gray-500">
                    📄 Credit card statements only · PDF format · No screenshots
                  </div>

                  <Button
                    className="mt-4"
                    onClick={handleAnalyze}
                    disabled={loading}
                  >
                    {loading ? "Analyzing..." : "Analyze"}
                  </Button>

                  {error && <p className="text-red-500 mt-4">{error}</p>}
                </motion.div>
              </TabsContent>

              {/* ------------ DASHBOARD TAB ------------ */}
              <TabsContent value="dashboard">
              <Tabs defaultValue="overview">
                <TabsList className="mb-6">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="merchants">Merchants</TabsTrigger>
                  <TabsTrigger value="category">Category Deep Dive</TabsTrigger>
                  <TabsTrigger value="transactions">Transactions</TabsTrigger>
                  <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
                </TabsList>

                {!analysis && (
                  <p className="text-center p-8 text-gray-500">
                    Upload statements to view analytics.
                  </p>
                )}
                {analysis && (
                  <>
                   
                    {/* OVERVIEW */}
                    <TabsContent value="overview" className="space-y-8">
                    {/* Spending Overview Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                      {/* Avg Monthly Spend */}
                      <Card>
                        <CardContent className="p-5">
                          <p className="text-sm text-gray-500">Avg Monthly Spend</p>
                          <p className="text-2xl font-bold">
                            ${avgMonthlySpend.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </p>
                        </CardContent>
                      </Card>

                      {/* Discretionary Spend */}
                      <Card>
                        <CardContent className="p-5">
                          <p className="text-sm text-gray-500">Discretionary Spend</p>
                          <p className="text-2xl font-bold">
                            ${discretionarySpend.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </p>
                        </CardContent>
                      </Card>

                      {/* Top Category */}
                      <Card>
                        <CardContent className="p-5">
                          <p className="text-sm text-gray-500">Top Category</p>
                          <p className="text-2xl font-bold">
                            {topCategory}
                          </p>
                        </CardContent>
                      </Card>

                      {/* Active Cards */}
                      <Card>
                        <CardContent className="p-5">
                          <p className="text-sm text-gray-500">Active Cards</p>
                          <p className="text-2xl font-bold">
                            {activeCards}
                          </p>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Monthly Bar Chart */}
                    <Card className="p-6 shadow">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold">
                          Monthly Spending by Category
                        </h3>

                        {/* CATEGORY FILTER — CHART ONLY */}
                        <select
                          value={selectedCategory}
                          onChange={(e) => setSelectedCategory(e.target.value)}
                          className="border p-2 rounded text-sm"
                        >
                          <option value="All">All Categories</option>
                          {allCategories
                            .filter((c) => c !== "All")
                            .map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                        </select>
                      </div>

                      <BarChart width={700} height={320} data={monthlyStackedData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis tickFormatter={formatCurrency} />
                        <Tooltip formatter={(value) => formatCurrency(value)} />
                        <Legend />

                        {stackCategories.map((cat, i) => (
                          <Bar
                            key={cat}
                            dataKey={cat}
                            stackId="a"
                            fill={chartColors[i % chartColors.length]}
                          />
                        ))}
                      </BarChart>
                    </Card>

                      </TabsContent>
                      <TabsContent value="merchants" className="space-y-8">
                      <Card className="p-6 shadow">
                      <h3 className="font-semibold mb-4">Top Merchants</h3>

                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm border">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="border px-3 py-2 text-left">Merchant</th>
                              <th className="border px-3 py-2 text-right">Total Spend</th>
                              <th className="border px-3 py-2 text-right">Transactions</th>
                              <th className="border px-3 py-2 text-right">Avg / Tx</th>
                            </tr>
                          </thead>

                          <tbody>
                            {merchantStats.map((m) => (
                              <tr key={m.merchant}>
                                <td className="border px-3 py-2 flex items-center gap-2">
                                  <span>{m.merchant}</span>

                                  {analysis.combined.flags.suspicious?.some(
                                    (s) => s.merchant === m.merchant
                                  ) && (
                                    <Badge variant="destructive">Recurring</Badge>
                                  )}
                                </td>
                                <td className="border px-3 py-2 text-right">
                                  ${m.total.toFixed(2)}
                                </td>
                                <td className="border px-3 py-2 text-right">{m.count}</td>
                                <td className="border px-3 py-2 text-right">
                                  ${(m.total / m.count).toFixed(2)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </Card>
                    </TabsContent>
                    <TabsContent value="category" className="space-y-8">
                    {!analysis ? (
                      <p className="text-gray-500">Upload statements first.</p>
                    ) : (
                      <>
                        {/* Category selector */}
                        <Card className="p-6">
                          <h3 className="font-semibold mb-3">Select Category</h3>
                          <select
                            value={deepDiveCategory || ""}
                            onChange={(e) => setDeepDiveCategory(e.target.value)}
                            className="border p-2 rounded"
                          >
                            <option value="">Choose category</option>
                            {allCategories
                              .filter((c) => c !== "All")
                              .map((c) => (
                                <option key={c} value={c}>
                                  {c}
                                </option>
                              ))}
                          </select>
                        </Card>

                        {!deepDiveCategory ? (
                          <p className="text-gray-500">
                            Select a category to see details.
                          </p>
                        ) : (
                          <>
                            {/* Stats */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                              <Card>
                                <CardContent className="p-5">
                                  <p className="text-sm text-gray-500">Total Spend</p>
                                  <p className="text-2xl font-bold">
                                    ${categoryStats.total.toFixed(2)}
                                  </p>
                                </CardContent>
                              </Card>

                              <Card>
                                <CardContent className="p-5">
                                  <p className="text-sm text-gray-500">Avg Monthly</p>
                                  <p className="text-2xl font-bold">
                                    ${categoryStats.avgMonthly.toFixed(2)}
                                  </p>
                                </CardContent>
                              </Card>

                              <Card>
                                <CardContent className="p-5">
                                  <p className="text-sm text-gray-500">Transactions</p>
                                  <p className="text-2xl font-bold">
                                    {categoryStats.transactions}
                                  </p>
                                </CardContent>
                              </Card>
                            </div>

                            {/* Monthly trend */}
                            <Card className="p-6">
                              <h3 className="font-semibold mb-4">
                                {deepDiveCategory} – Monthly Trend
                              </h3>

                              <BarChart width={700} height={300} data={categoryMonthlyTrend}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="month" />
                                <YAxis tickFormatter={formatCurrency} />
                                <Tooltip formatter={(v) => formatCurrency(v)} />
                                <Bar dataKey="amount" fill="#6c5ce7" />
                              </BarChart>
                            </Card>

                            {/* Top merchants */}
                            <Card className="p-6">
                              <h3 className="font-semibold mb-4">
                                Top Merchants – {deepDiveCategory}
                              </h3>

                              <table className="min-w-full text-sm border">
                                <thead className="bg-gray-100">
                                  <tr>
                                    <th className="border p-2 text-left">Merchant</th>
                                    <th className="border p-2 text-right">Total</th>
                                    <th className="border p-2 text-right">Tx</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {categoryMerchants.map((m) => (
                                    <tr key={m.merchant}>
                                      <td className="border p-2">{m.merchant}</td>
                                      <td className="border p-2 text-right">
                                        ${m.total.toFixed(2)}
                                      </td>
                                      <td className="border p-2 text-right">{m.count}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </Card>
                          </>
                        )}
                      </>
                    )}
                  </TabsContent>

                    <TabsContent value="transactions" className="space-y-8">
                    {/* Search */}
                    <Input
                      placeholder="Search by merchant or category..."
                      value={search}
                      onChange={handleSearch}
                      className="mb-3"
                    />

                    {/* Transactions Table */}
                    <Card className="p-6 shadow overflow-x-auto">
                      <h3 className="font-semibold mb-4">All Transactions</h3>

                      <table className="min-w-full border text-sm">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="px-3 py-2 border">Date</th>
                            <th className="px-3 py-2 border">Merchant</th>
                            <th className="px-3 py-2 border">Amount</th>
                            <th className="px-3 py-2 border">Category</th>
                            <th className="px-3 py-2 border">File Name</th>
                          </tr>
                        </thead>

                        <tbody>
                          {filteredTx.map((t, i) => (
                            <tr key={i}>
                              <td className="border px-3 py-1">{t.date}</td>
                              <td className="border px-3 py-1">{t.merchant}</td>
                              <td className="border px-3 py-1">
                                ${t.amount.toFixed(2)}
                              </td>
                              <td className="border px-3 py-1">
                                <Badge>{t.category}</Badge>
                              </td>
                              <td className="border px-3 py-1">
                                {t.source_file}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      <div className="flex gap-3 mt-4">
                        <Button onClick={downloadCSV}>
                          <FileDown className="mr-1 w-4 h-4" /> CSV
                        </Button>
                        <Button onClick={downloadExcel}>
                          <FileDown className="mr-1 w-4 h-4" /> Excel
                        </Button>
                      </div>
                    </Card>
                    </TabsContent>
                    <TabsContent value="recommendations" className="space-y-8">
                    {/* Recommendations */}
                    <Card className="p-6 shadow">
                      <h3 className="font-semibold mb-4">Personalized Insights</h3>
                      <div className="space-y-3">
                        {analysis.combined.global_recommendations.map((r, i) => (
                          <div
                            key={i}
                            className="p-3 bg-purple-100 rounded-lg border"
                          >
                            {r}
                          </div>
                        ))}
                      </div>
                    </Card>
              </TabsContent>
              </>
              )}
              </Tabs>
              </TabsContent>

              {/* ------------ ASSISTANT PLACEHOLDER ------------ */}
              <TabsContent value="assistant">
                <div className="p-8 text-center">
                  (Coming soon: Ask questions about your spending!)
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
