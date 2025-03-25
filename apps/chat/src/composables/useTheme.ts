import { ref, watch } from "vue";

export function useTheme() {
	const isDarkMode = ref(false);

	// Initialize theme from localStorage or system preference
	const initTheme = () => {
		const savedTheme = localStorage.getItem("theme");
		if (savedTheme) {
			isDarkMode.value = savedTheme === "dark";
		} else {
			isDarkMode.value = window.matchMedia(
				"(prefers-color-scheme: dark)",
			).matches;
		}
		applyTheme();
	};

	// Apply theme to document
	const applyTheme = () => {
		if (isDarkMode.value) {
			document.documentElement.classList.add("dark");
			localStorage.setItem("theme", "dark");
		} else {
			document.documentElement.classList.remove("dark");
			localStorage.setItem("theme", "light");
		}
	};

	// Toggle theme
	const toggleTheme = () => {
		isDarkMode.value = !isDarkMode.value;
		applyTheme();
	};

	// Watch for system theme changes
	const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
	const handleSystemThemeChange = (e: MediaQueryListEvent) => {
		if (!localStorage.getItem("theme")) {
			isDarkMode.value = e.matches;
			applyTheme();
		}
	};

	mediaQuery.addEventListener("change", handleSystemThemeChange);

	// Initialize theme on mount
	initTheme();

	return {
		isDarkMode,
		toggleTheme,
		initTheme,
	};
}
