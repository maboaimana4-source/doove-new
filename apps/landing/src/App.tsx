import React from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import PayPage from "./pages/pay/PayPage";

function App() {
	return (
		<BrowserRouter>
			<Routes>
				<Route path="/" element={<LandingPage />} />
				<Route path="/pay" element={<PayPage />} />
			</Routes>
		</BrowserRouter>
	);
}

export default App;
