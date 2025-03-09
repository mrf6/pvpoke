<?php

$META_TITLE = 'Team Generator';

$META_DESCRIPTION = 'Generate rankings and analysis for a pre-defined team in Pokemon GO Trainer Battles. See how your team matches up offensively and defensively, and discover which Pokemon are the best counters to yours.';

$CANONICAL = '/team-generator/';

require_once 'header.php';

?>

<h1>Team Generator</h1>

<div class="section league-select-container team-content white">
	<p>This tool calculates team threat scores and analysis for a manually defined team. The team is pre-configured in the code and can be modified there.</p>
	<?php require 'modules/formatselect.php'; ?>
</div>

<div class="button-container">
	<!-- <button class="generate-rankings-btn button">
		<span class="btn-content-wrap">
			<span class="btn-icon btn-icon-analysis"></span>
			<span class="btn-label">Generate Rankings</span>
		</span>
	</button> -->
	<button class="evaluate-all-teams-btn button">
		<span class="btn-content-wrap">
			<span class="btn-icon btn-icon-analysis"></span>
			<span class="btn-label">Find Best Teams</span>
		</span>
	</button>
</div>

<div class="section white error">No team has been defined. Please define a team in the TeamGeneratorRank.js file.</div>

<?php require 'modules/ads/body-728.php'; ?>

<div class="section typings white">
	<!-- <a href="#" class="toggle active">Potential Threats <span class="arrow-down">&#9660;</span><span class="arrow-up">&#9650;</span></a>
	<div class="toggle-content article">
		<p>The Pokemon below have the best overall matchups against this team. Results are taken from 0 and 1 shield simulations. Scores also factor in a Pokemon's overall strength and consistency.</p>
		<div class="table-container">
			<table class="threats-table rating-table" cellspacing="0">
			</table>
		</div>
		<p class="center">This team has a threat score of <b class="threat-score"></b></p>
		<p class="small"><strong>Threat score</strong> measures how vulnerable your team may be to specific Pokemon. The smaller the number, the better. It factors in how many Pokemon on your team can be threatened, how hard they're threatened, a threat's overall ranking (how likely you may be to encounter it), and how consistently it performs.</p>
	</div> -->
	<div class="rankings-container"></div>

	<!-- <div class="share-link-container">
		<p>Share this team:</p>
		<div class="share-link">
			<input type="text" value="" readonly>
			<div class="copy">Copy</div>
		</div>
	</div> -->
</div>

<style>
/* Styles for progress bar and team evaluation */
.processing-message {
    margin: 20px 0;
    text-align: center;
}

.progress-container {
    width: 100%;
    height: 20px;
    background-color: #f3f3f3;
    border-radius: 10px;
    margin: 15px 0;
    overflow: hidden;
}

.progress-bar {
    height: 100%;
    background-color: #3498db;
    width: 0%;
    transition: width 0.3s ease;
}

.progress-text, .teams-processed {
    text-align: center;
    margin: 10px 0;
}

.teams-table {
    width: 100%;
    margin: 20px 0;
    border-collapse: collapse;
}

.teams-table th, .teams-table td {
    padding: 8px 12px;
    text-align: left;
    border-bottom: 1px solid #ddd;
}

.teams-table th {
    background-color: #f2f2f2;
    font-weight: bold;
}

.teams-table tbody tr {
    cursor: pointer;
    transition: background-color 0.2s;
}

.teams-table tbody tr:hover {
    background-color: #f5f5f5;
}
</style>

<?php require_once 'modules/search-string-help.php'; ?>
<?php require_once 'modules/search-traits.php'; ?>

<!--test 4-->
<script src="<?php echo $WEB_ROOT; ?>js/GameMaster.js?v=<?php echo $SITE_VERSION; ?>"></script>
<script src="<?php echo $WEB_ROOT; ?>js/pokemon/Pokemon.js?v=<?php echo $SITE_VERSION; ?>"></script>
<script src="<?php echo $WEB_ROOT; ?>js/interface/TeamInterface.js?v=<?php echo $SITE_VERSION; ?>"></script>
<script src="<?php echo $WEB_ROOT; ?>js/interface/PokeMultiSelect.js?v=<?php echo $SITE_VERSION; ?>"></script>
<script src="<?php echo $WEB_ROOT; ?>js/interface/Pokebox.js?=<?php echo $SITE_VERSION; ?>"></script>
<script src="<?php echo $WEB_ROOT; ?>js/interface/PokeSelect.js?v=<?php echo $SITE_VERSION; ?>"></script>
<script src="<?php echo $WEB_ROOT; ?>js/interface/BattleHistogram.js?v=<?php echo $SITE_VERSION; ?>"></script>
<script src="<?php echo $WEB_ROOT; ?>js/interface/ModalWindow.js?v=<?php echo $SITE_VERSION; ?>"></script>
<script src="<?php echo $WEB_ROOT; ?>js/interface/PokeSearch.js?v=<?php echo $SITE_VERSION; ?>"></script>
<script src="<?php echo $WEB_ROOT; ?>js/battle/TimelineEvent.js?v=<?php echo $SITE_VERSION; ?>"></script>
<script src="<?php echo $WEB_ROOT; ?>js/battle/TimelineAction.js?v=<?php echo $SITE_VERSION; ?>"></script>
<script src="<?php echo $WEB_ROOT; ?>js/battle/Battle.js?v=<?php echo $SITE_VERSION; ?>"></script>
<script src="<?php echo $WEB_ROOT; ?>js/battle/TeamRanker.js?v=<?php echo $SITE_VERSION; ?>"></script>
<script src="<?php echo $WEB_ROOT; ?>js/interface/TeamGeneratorRank.js?v=<?php echo $SITE_VERSION; ?>"></script>
<script src="<?php echo $WEB_ROOT; ?>js/Main.js?v=3"></script>

<script>
// Wait for the document and all components to be fully loaded
$(document).ready(function() {
	console.log("Document ready");
	
	// First ensure TeamInterface is initialized
	if (typeof InterfaceMaster !== "undefined") {
		console.log("Initializing InterfaceMaster first...");
		var interfaceMaster = InterfaceMaster.getInstance();
		if (interfaceMaster) {
			interfaceMaster.init();
			console.log("InterfaceMaster initialized");
		}
	}
	
	// Set up the Generate Rankings button
	$(".generate-rankings-btn").on("click", function() {
		console.log("Generate Rankings button clicked");
		
		// Hide error message by default
		$(".section.error").hide();
		
		// Update button text to show loading state
		$(this).find(".btn-label").html("Loading...");
		
		// Call the TeamGeneratorRank function
		var teamGenerator = InterfaceMaster.getInstance();
		teamGenerator.context = "team-generator";
		var result = teamGenerator.calculateTeamEffectiveness();
		
		// Only restore button text if the calculation didn't start yet
		// (If ranking data needs to be loaded first)
		if (result === false) {
			console.log("Waiting for ranking data to load...");
		} else {
			// Reset button text after calculations complete
			$(this).find(".btn-label").html("Generate Rankings");
		}
	});
	
	// Set up the Evaluate All Teams button
	$(".evaluate-all-teams-btn").on("click", function() {
		console.log("Evaluate All Teams button clicked");
		
		// Hide error message by default
		$(".section.error").hide();
		
		// Display warning with confirm dialog
		// if (confirm("This will evaluate thousands of team combinations and may take several minutes to complete. Do you want to continue?")) {
		// 	// Call the evaluate all teams function
		// }

		var teamGenerator = InterfaceMaster.getInstance();
		teamGenerator.context = "team-generator";
		teamGenerator.evaluateAllTeams();
	});
	
	// Copy share link to clipboard
	$(".share-link .copy").on("click", function(e){
		e.preventDefault();
		
		var copyText = $(this).siblings("input")[0];
		copyText.select();
		document.execCommand("copy");
		
		$(this).html("Copied!");
		
		setTimeout(function(){
			$(".share-link .copy").html("Copy");
		}, 2000);
	});
});
</script>

<?php require_once 'footer.php'; ?>
