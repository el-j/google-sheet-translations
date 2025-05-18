// @ts-nocheck
export async function register() {
	if (process.env.NEXT_RUNTIME === "nodejs") {	
		const getData = await import("google-sheet-translations");
		await getData.getSpreadSheetData(["Index"]);
		console.log("register done");
	}
}
