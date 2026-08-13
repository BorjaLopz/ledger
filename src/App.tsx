import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { LoginPage } from "./features/auth/LoginPage";
import { CategoriesPage } from "./features/categories/CategoriesPage";
import { AnalyticsPage } from "./features/dashboard/AnalyticsPage";
import { ResumenPage } from "./features/dashboard/ResumenPage";
import { NetWorthPage } from "./features/networth/NetWorthPage";
import { RecurringPage } from "./features/recurring/RecurringPage";
import { TransactionsPage } from "./features/transactions/TransactionsPage";
import { queryClient } from "./lib/queryClient";
import { AppLayout } from "./routes/AppLayout";
import { AuthListener } from "./routes/AuthListener";
import { ConfirmDialog } from "./routes/ConfirmDialog";
import { ProtectedRoute } from "./routes/ProtectedRoute";

function App() {
	return (
		<QueryClientProvider client={queryClient}>
			<BrowserRouter>
				<AuthListener />
				<ConfirmDialog />
				<Routes>
					<Route path="/login" element={<LoginPage />} />
					<Route element={<ProtectedRoute />}>
						<Route element={<AppLayout />}>
							<Route path="/" element={<ResumenPage />} />
							<Route path="/transacciones" element={<TransactionsPage />} />
							<Route path="/recurrentes" element={<RecurringPage />} />
							<Route path="/dashboard" element={<AnalyticsPage />} />
							<Route path="/patrimonio" element={<NetWorthPage />} />
							<Route path="/categorias" element={<CategoriesPage />} />
						</Route>
					</Route>
				</Routes>
			</BrowserRouter>
		</QueryClientProvider>
	);
}

export default App;
