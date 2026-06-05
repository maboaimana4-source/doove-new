import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, CreditCard, Lock, Shield, Zap } from "lucide-react";
import React, { useState } from "react";

const PayPage = () => {
	const [email, setEmail] = useState("");
	const [isLoading, setIsLoading] = useState(false);

	const handlePayment = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsLoading(true);

		try {
			const response = await fetch("https://imara.cloud/api/subscription/create-payment", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				mode: "cors",
				body: JSON.stringify({ user_id: email, tier: "pro" }),
			});

			if (!response.ok) {
				let errorMessage = "Error communicating with the payment server.";
				try {
					const error = await response.json();
					errorMessage = error.error || errorMessage;
				} catch (_e) {
					// Ignore parse error
				}
				throw new Error(errorMessage);
			}

			const data = await response.json();
			if (data.url) {
				window.location.href = data.url;
			} else {
				throw new Error("MoneyFusion payment URL was not returned.");
			}
		} catch (error) {
			console.error("Payment Error:", error);
			alert(
				"An error occurred: " + (error instanceof Error ? error.message : "Unknown error"),
			);
			setIsLoading(false);
		}
	};

	return (
		<div className="min-h-screen bg-zinc-950 text-white selection:bg-doove-purple/30">
			<nav className="p-6 border-b border-white/5">
				<div className="max-w-7xl mx-auto flex items-center gap-2">
					<img src="/logo.svg" alt="Doove" className="w-8 h-8" />
					<span className="text-xl font-bold tracking-tight uppercase">
						Doove Checkout
					</span>
				</div>
			</nav>

			<main className="max-w-4xl mx-auto px-4 py-20 flex flex-col md:flex-row gap-16 items-center">
				<div className="flex-1">
					<motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
						<span className="text-doove-purple font-bold tracking-widest text-xs uppercase mb-4 block">
							Final Step
						</span>
						<h1 className="text-5xl font-black mb-8 leading-tight">
							Upgrade to <span className="gradient-text">Doove Pro</span>
						</h1>
						<p className="text-zinc-400 text-lg mb-8 leading-relaxed">
							Unlock the full potential of Doove. Unlimited recordings, no time
							limits, and priority support.
						</p>

						<div className="space-y-6">
							{[
								{
									icon: <Zap size={20} />,
									title: "Unlimited Access",
									desc: "Record as much as you want, with no time limits.",
								},
								{
									icon: <Shield size={20} />,
									title: "Secure Payment",
									desc: "Transactions powered by MoneyFusion.",
								},
								{
									icon: <CheckCircle2 size={20} />,
									title: "Instant Activation",
									desc: "Receive your Pro key immediately after payment.",
								},
							].map((item, i) => (
								<div
									key={i}
									className="flex gap-4 items-start p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors"
								>
									<div className="p-2 rounded-xl bg-doove-purple/20 text-doove-purple">
										{item.icon}
									</div>
									<div>
										<h3 className="font-bold">{item.title}</h3>
										<p className="text-sm text-zinc-500">{item.desc}</p>
									</div>
								</div>
							))}
						</div>
					</motion.div>
				</div>

				<div className="flex-1 w-full max-w-md">
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						className="p-8 rounded-[2.5rem] bg-zinc-900 border border-white/10 shadow-2xl relative overflow-hidden"
					>
						<div className="absolute top-0 right-0 p-8 opacity-5">
							<CreditCard size={120} />
						</div>

						<div className="mb-8">
							<div className="text-zinc-500 text-sm font-medium mb-1 uppercase tracking-wider">
								Monthly Subscription
							</div>
							<div className="flex items-baseline gap-2">
								<span className="text-5xl font-black">5000 FCFA</span>
								<span className="text-zinc-500">/month</span>
							</div>
						</div>

						<form onSubmit={handlePayment} className="space-y-6">
							<div>
								<label className="block text-sm font-medium text-zinc-400 mb-2">
									Email Address
								</label>
								<input
									required
									type="email"
									value={email}
									onChange={(e) => setEmail(e.target.value)}
									placeholder="your@email.com"
									className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-doove-purple transition-colors"
								/>
							</div>

							<button
								disabled={isLoading}
								className="w-full bg-white text-black py-4 rounded-xl font-bold text-lg hover:bg-zinc-200 transition-all flex items-center justify-center gap-2 group"
							>
								{isLoading ? (
									"Processing..."
								) : (
									<>
										Pay with MoneyFusion
										<ArrowRight
											size={20}
											className="group-hover:translate-x-1 transition-transform"
										/>
									</>
								)}
							</button>

							<div className="flex items-center justify-center gap-2 text-zinc-500 text-xs">
								<Lock size={14} />
								Encrypted and secure payment
							</div>
						</form>
					</motion.div>
				</div>
			</main>

			<footer className="max-w-7xl mx-auto px-6 py-12 border-t border-white/5 text-center text-zinc-600 text-sm">
				© 2026 Doove Team. Powered by MoneyFusion.
			</footer>
		</div>
	);
};

export default PayPage;
