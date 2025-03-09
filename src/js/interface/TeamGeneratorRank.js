var InterfaceMaster = (function () {
    var instance;

    function createInstance() {
        var object = new interfaceObject();

		function interfaceObject(){
			// Constants for common values
			const POKEMON_TYPES = ["Bug","Dark","Dragon","Electric","Fairy","Fighting","Fire","Flying","Ghost","Grass","Ground","Ice","Normal","Poison","Psychic","Rock","Steel","Water"];
			const DEFAULT_SHIELD_MODE = "average";
			const DEFAULT_SHIELD_COUNT = 1;
			const DEFAULT_SCORECARD_COUNT = 20;
			
			var gm;
			var battle;
			var results; // Store team matchup results for later reference
			var altRankings; // Store alternatives for searching
			var counterTeam;
			var self = this;
			var runningResults = false;
			var host = window.location.hostname;

			this.context = "team";

			// Initialize the interface
			this.init = function(){
				gm = GameMaster.getInstance();
				battle = new Battle();
			};
			
			// Helper function to configure battle settings
			function configureBattle() {
				// Set up battle parameters using selected format
				var formatValue = $(".format-select").val();
				var cupValue = $(".format-select option:selected").attr("cup") || "all";
				var cp = parseInt(formatValue) || 1500;
				
				battle.setCP(cp);
				battle.setCup(cupValue);
				
				console.log("Using format: CP " + cp + ", Cup: " + cupValue);
				
				return { cp, cupValue };
			}
			
			// Helper function to setup shield and battle settings
			function setupBattleSettings(baitShields) {
				var shieldMode = DEFAULT_SHIELD_MODE;
				var shieldCount = DEFAULT_SHIELD_COUNT;
				
				if(shieldMode != "average"){
					shieldCount = parseInt(shieldMode);
					shieldMode = "single";
				}
				
				var teamSettings = getDefaultMultiBattleSettings();
				var opponentSettings = getDefaultMultiBattleSettings();
				
				teamSettings.shields = opponentSettings.shields = shieldCount;
				teamSettings.bait = opponentSettings.bait = baitShields;
				
				var ranker = RankerMaster.getInstance();
				ranker.setShieldMode(shieldMode);
				ranker.applySettings(teamSettings, 0);
				ranker.applySettings(opponentSettings, 1);
				ranker.setRecommendMoveUsage(true);
				
				return { 
					ranker, 
					shieldMode, 
					shieldCount, 
					teamSettings, 
					opponentSettings 
				};
			}
			
			// Create default team
			function createDefaultTeam(battle) {
				var team = [];
				// Default Pokemon with recommended movesets
				var defaultPokemon = ["azumarill", "medicham", "skarmory"];
				
				for(var i = 0; i < defaultPokemon.length; i++) {
					var poke = new Pokemon(defaultPokemon[i], 0, battle);
					poke.initialize(battle.getCP());
					poke.selectRecommendedMoveset("overall");
					team.push(poke);
				}
				
				return team;
			}

			// Primary function to calculate team effectiveness and display results
			this.calculateTeamEffectiveness = function() {
				console.log("Calculating team effectiveness");

				// Initialize variables
				var scorecardCount = DEFAULT_SCORECARD_COUNT;
				var allowShadows = true;
				var allowXL = true;
				var baitShields = true;

				// Hide error message
				$(".section.error").hide();

				// Get team and validate results (empty team will be populated with defaults later)
				var team = []; // MANUALLY SET TEAM IN THE CODE
				
				// Setup battle
				configureBattle();
				
				// Make sure ranking data is loaded for recommended movesets
				var key = battle.getCup().name + "overall" + battle.getCP();
				if (!gm.rankings[key]) {
					// Instead of returning false, store a reference to this for callback
					gm.loadRankingData({
						displayRankingData: function() {
							console.log("Ranking data loaded, analyzing team");
							// Now that data is loaded, perform the team analysis
							performTeamAnalysis(team, scorecardCount, baitShields);
							// Reset the button text 
							$(".generate-rankings-btn .btn-label").html("Generate Rankings");
						}
					}, "overall", battle.getCP(), battle.getCup().name);
					console.log("Loading ranking data for movesets");
					return false;
				}

				// If ranking data is already loaded, continue directly
				return performTeamAnalysis(team, scorecardCount, baitShields);
			}

			// Add a new function to evaluate all possible teams
			this.evaluateAllTeams = function() {
				console.log("Starting evaluation of all possible teams");
				
				// Update button text to show processing
				$(".evaluate-all-teams-btn .btn-label").html("Processing (this may take a while)...");
				
				// Initialize variables
				var scorecardCount = DEFAULT_SCORECARD_COUNT;
				var allowShadows = true;
				var allowXL = true;
				var baitShields = true;
				
				// Setup battle
				configureBattle();
				
				// Make sure ranking data is loaded
				var key = battle.getCup().name + "overall" + battle.getCP();
				if (!gm.rankings[key]) {
					// Load ranking data first, then continue
					gm.loadRankingData({
						displayRankingData: function() {
							console.log("Ranking data loaded, starting team evaluation");
							self.continueAllTeamsEvaluation(battle, gm, scorecardCount, allowShadows, allowXL, baitShields);
						}
					}, "overall", battle.getCP(), battle.getCup().name);
					console.log("Loading ranking data first");
					return false;
				}
				
				// If ranking data is already loaded, continue directly
				return this.continueAllTeamsEvaluation(battle, gm, scorecardCount, allowShadows, allowXL, baitShields);
			}
			
			// Process all possible teams once ranking data is loaded
			this.continueAllTeamsEvaluation = function(battle, gm, scorecardCount, allowShadows, allowXL, baitShields) {
				console.log("Continuing evaluation of all possible teams");
				
				// Show processing information
				$(".typings").show();
				$(".section.typings .rankings-container").html('<div class="processing-message"><p>Processing all possible teams. This may take several minutes...</p><div class="progress-container"><div class="progress-bar"></div></div><p class="progress-text">0% complete</p><p class="teams-processed">0 teams processed</p></div>');
				
				// Get the top 50 Pokémon from rankings
				var key = battle.getCup().name + "overall" + battle.getCP();
				var rankings = gm.rankings[key];
				var topPokemon = [];
				var teamResults = [];
				var totalProcessed = 0;
				
				// Get the top 50 Pokémon (or less if not available)
				var numToGet = Math.min(20, rankings.length);
				for (var i = 0; i < numToGet; i++) {
					var pokeData = rankings[i];
					
					// Add to our list of top Pokémon
					topPokemon.push(pokeData.speciesId);
				}
				
				console.log("Using top " + topPokemon.length + " Pokémon to generate teams");
				
				// Generate all possible 3-Pokémon combinations
				var combinations = this.generateCombinations(topPokemon, 3);
				console.log("Generated " + combinations.length + " possible team combinations");
				
				// Calculate total number of combinations
				var totalCombinations = combinations.length;
				var batchSize = 20; // Increased batch size for performance
				var batchIndex = 0;
				
				// Function to process teams in batches to prevent UI freezing
				var processNextBatch = function() {
					// Get the next batch of teams to process
					var endIndex = Math.min(batchIndex + batchSize, totalCombinations);
					
					// Process each team in the current batch
					for (var i = batchIndex; i < endIndex; i++) {
						var teamSpeciesIds = combinations[i];
						var team = [];
						var pokemonNames = []; // Store just the names for display
						
						// Create Pokémon objects for the team
						for (var j = 0; j < teamSpeciesIds.length; j++) {
							var pokemon = new Pokemon(teamSpeciesIds[j], 0, battle);
							pokemon.initialize(battle.getCP());
							pokemon.selectRecommendedMoveset("overall");
							team.push(pokemon);
							pokemonNames.push(pokemon.speciesName); // Store just the name
						}
						
						// Generate team rankings - streamlined calculation
						var teamData = calculateTeamRankings(team, battle, baitShields);
						
						// Calculate the threat score from the rankings
						var score = calculateTeamThreatScore(teamData.rankings);
						
						// Add result to the list - only store names and score, not entire Pokémon objects
						teamResults.push({
							pokemonNames: pokemonNames,
							threatScore: score
						});
						
						// Free memory by explicitly clearing these variables
						team = null;
						teamData = null;
						
						totalProcessed++;
					}
					
					// Update progress
					var percentComplete = Math.floor((totalProcessed / totalCombinations) * 100);
					$(".progress-bar").css("width", percentComplete + "%");
					$(".progress-text").text(percentComplete + "% complete");
					$(".teams-processed").text(totalProcessed + " of " + totalCombinations + " teams processed");
					
					// Continue processing if not done
					batchIndex = endIndex;
					if (batchIndex < totalCombinations) {
						setTimeout(processNextBatch, 0); // Allow UI to update
					} else {
						// All teams processed, display results
						displayResults();
					}
				};
				
				// Function to display the final results - simplified to just show teams and scores
				var displayResults = function() {
					console.log("All teams processed, displaying results");
					
					// Sort teams by threat score (lowest to highest)
					teamResults.sort(function(a, b) {
						return a.threatScore - b.threatScore;
					});
					
					// Display the top 100 teams
					var numToShow = Math.min(100, teamResults.length);
					var html = '<h3>Top ' + numToShow + ' Teams (Lowest Threat Score)</h3>';
					html += '<table class="teams-table rating-table" cellspacing="0">';
					html += '<thead><tr><th>Rank</th><th>Team</th><th>Threat Score</th></tr></thead><tbody>';
					
					for (var i = 0; i < numToShow; i++) {
						var result = teamResults[i];
						var teamStr = result.pokemonNames.join(', ');
						
						html += '<tr>';
						html += '<td>' + (i + 1) + '</td>';
						html += '<td>' + teamStr + '</td>';
						html += '<td>' + result.threatScore + '</td>';
						html += '</tr>';
					}
					
					html += '</tbody></table>';
					
					// Display results - no fancy interactive analysis
					$(".section.typings .rankings-container").html(html);
					
					// Reset button text
					$(".generate-rankings-btn .btn-label").html("Generate Rankings");
					
					// Try to free some memory
					combinations = null;
					teamResults = teamResults.slice(0, numToShow);
				};
				
				// Start processing teams
				processNextBatch();
				
				return true;
			}
			
			// Generate all possible combinations of size k from an array
			this.generateCombinations = function(arr, k) {
				var combinations = [];
				
				// Helper function for recursive combination generation
				function generate(prefix, arr, k, start) {
					if (k === 0) {
						combinations.push(prefix.slice());
						return;
					}
					
					for (var i = start; i <= arr.length - k; i++) {
						prefix.push(arr[i]);
						generate(prefix, arr, k - 1, i + 1);
						prefix.pop();
					}
				}
				
				generate([], arr, k, 0);
				return combinations;
			}
			
			// Centralized function to calculate team rankings - used by multiple functions
			function calculateTeamRankings(team, battle, baitShields) {
				// Setup battle settings
				var battleConfig = setupBattleSettings(baitShields);
				var ranker = battleConfig.ranker;
				
				// Rank team against potential threats
				var data = ranker.rank(team, battle.getCP(), battle.getCup(), [], "team-counters");
				
				// Sort rankings by score descending
				data.rankings.sort((a,b) => (a.score > b.score) ? -1 : ((b.score > a.score) ? 1 : 0));
				
				return {
					rankings: data.rankings,
					battleConfig: battleConfig
				};
			}
			
			// Calculate threat score for a specific team
			function calculateTeamThreatScore(rankings) {
				// Calculate average threat score from top 20 threats
				var avgThreatScore = 0;
				var count = Math.min(DEFAULT_SCORECARD_COUNT, rankings.length);
				
				for (var i = 0; i < count; i++) {
					avgThreatScore += rankings[i].score;
				}
				
				return Math.round(avgThreatScore / count);
			}
			
			// Main function to handle team analysis
			function performTeamAnalysis(team, scorecardCount, baitShields) {
				// If team is empty, create the default team
				if (team.length === 0) {
					team = createDefaultTeam(battle);
				}
				
				if(team.length === 0){
					$(".section.error").show();
					return false;
				}
				
				// Calculate team rankings only once
				var teamData = calculateTeamRankings(team, battle, baitShields);
				var counterRankings = teamData.rankings;
				
				// Calculate and display threat score only - no detailed analysis
				var avgThreatScore = calculateTeamThreatScore(counterRankings);
				
				// Update page title with team name
				var teamNameStr = team[0].speciesName;
				var i = 1;
				
				for(i = 1; i < Math.min(team.length, 3); i++){
					teamNameStr += ", " + team[i].speciesName;
				}
				
				if(i < team.length){
					teamNameStr += "+" + (team.length - i);
				}
				
				// Display only the threat score
				$(".typings").show();
				$(".section.typings .rankings-container").html('<p>Team Threat Score: ' + avgThreatScore + '</p>');
				
				document.title = teamNameStr + " - Team Generator | PvPoke";
				
				return true;
			}
			

			// Given a subject type, produce effectiveness array for offense or defense
			this.getTypeEffectivenessArray = function(subjectTypes, direction){
				var arr = [];
				var battle = new Battle();

				for(var n = 0; n < POKEMON_TYPES.length; n++){
					var effectiveness;
					var typeToCheck = POKEMON_TYPES[n];
					
					if(direction == "offense"){
						effectiveness = battle.getEffectiveness(subjectTypes[0], [typeToCheck]);
					} else if(direction == "defense"){
						effectiveness = battle.getEffectiveness(typeToCheck, subjectTypes);
					}

					// Round to nearest thousandths to avoid Javascript floating point wonkiness
					effectiveness = Math.floor(effectiveness * 1000) / 1000;
					arr.push(effectiveness);
				}

				return arr;
			}

			// Array of all types
			this.getAllTypes = function(){
				return POKEMON_TYPES.slice(); // Return a copy to prevent modification
			}
        }

        return object;
    }

    return {
        getInstance: function() {
            if (!instance) {
                instance = createInstance();
            }
            return instance;
        }
    };
})();
