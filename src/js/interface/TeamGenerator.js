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
            var battleResults;
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
			
            // Main function to evaluate all teams - This will be called from the button
            this.evaluateAllTeams = function() {
                console.log("Starting evaluation of all possible teams");
                
                // Update button text to show processing
                $(".evaluate-all-teams-btn .btn-label").html("Processing (this may take a while)...");
                
                // Setup battle
                var formatValue = $(".format-select").val();
                var cupValue = $(".format-select option:selected").attr("cup") || "all";
                var cp = parseInt(formatValue) || 1500;
                
                battle.setCP(cp);
                battle.setCup(cupValue);
                
                // Make sure ranking data is loaded
                var key = battle.getCup().name + "overall" + battle.getCP();
                if (!gm.rankings[key]) {
                    // Load ranking data first, then continue
                    gm.loadRankingData({
                        displayRankingData: function() {
                            console.log("Ranking data loaded, starting team evaluation");
                            runTeamEvaluation();
                        }
                    }, "overall", battle.getCP(), battle.getCup().name);
                    console.log("Loading ranking data first");
                    return false;
                }
                
                // If ranking data is already loaded, continue directly
                return runTeamEvaluation();
            };
            
            // Main function that runs the team evaluation process
            function runTeamEvaluation() {
                // Show processing information
                $(".typings").show();
                $(".section.typings .rankings-container").html('<div class="processing-message"><p>Processing all possible teams. This may take several minutes...</p><div class="progress-container"><div class="progress-bar"></div></div><p class="progress-text">0% complete</p><p class="teams-processed">0 teams processed</p></div>');
                
                // Get all Pokémon data
                var pokemonData = getAllPokemon(gm);
                var allPokemon = pokemonData.allPokemon;
                var topPokemon = pokemonData.topPokemon;
                
                console.log("Using top " + topPokemon.length + " Pokémon to generate teams");
                
                // Generate all possible 3-Pokémon combinations
                var teams = generateTeams(topPokemon);
                console.log("Generated " + teams.length + " possible team combinations");
                
                // Generate all possible matchups, INCLUDING self-matchups (same Pokemon vs itself)
                var allMatchups = generateMatchups(allPokemon, true);
                console.log("Generated " + allMatchups.length + " possible matchups (including self-matchups)");
                
                // Process in batches to prevent UI freezing
                processBattlesInBatches(teams, allMatchups, allPokemon);
                
                return true;
            }
            
            // Process battles in batches to keep the UI responsive
            function processBattlesInBatches(teams, allMatchups, allPokemon) {
                var totalTeams = teams.length;
                var battleResults = {};
                var teamResults = [];
                
                console.log("Starting to process " + totalTeams + " teams in batches");
                
                // Process matchups first
                processMatchupBatch(0, allMatchups, battleResults, function() {
                    // After all matchups are processed, process teams
                    processTeamBatch(0, teams, battleResults, allPokemon, teamResults, function(rankedTeams) {
                        // When all teams are processed, display results
                        displayResults(rankedTeams);
                    });
                });
            }
            
            // Process matchups in batches - Run all 9 possible shield scenarios
            function processMatchupBatch(startIndex, allMatchups, battleResults, callback) {
                var batchSize = 10; // Reduced batch size since we're doing nine battles per matchup
                var endIndex = Math.min(startIndex + batchSize, allMatchups.length);
                
                // Define all shield scenarios
                var shieldScenarios = [
                    {atk: 0, def: 0},
                    {atk: 0, def: 1},
                    {atk: 0, def: 2},
                    {atk: 1, def: 0},
                    {atk: 1, def: 1},
                    {atk: 1, def: 2},
                    {atk: 2, def: 0},
                    {atk: 2, def: 1},
                    {atk: 2, def: 2}
                ];
                
                for (var i = startIndex; i < endIndex; i++) {
                    var matchup = allMatchups[i];
                    
                    // Run all shield scenarios
                    for (var s = 0; s < shieldScenarios.length; s++) {
                        var scenario = shieldScenarios[s];
                        
                        // Run battle with specific shield configuration
                        var result = runBattle(matchup[0], matchup[1], scenario.atk, scenario.def);
                        
                        // Create key format that includes both shield counts: "atk_def_pokemon1_pokemon2"
                        var keyFormat = scenario.atk + "_" + scenario.def + "_";
                        
                        // Store results with shield counts in the key
                        // First key: pokemon1's perspective (attacking with atk shields against pokemon2 with def shields)
                        // Second key: pokemon2's perspective (attacking with def shields against pokemon1 with atk shields)
                        battleResults[keyFormat + matchup[0] + "_" + matchup[1]] = result.poke2rating;
                        battleResults[keyFormat + matchup[1] + "_" + matchup[0]] = result.poke1rating;
                    }
                }
                
                // Update progress
                var percentComplete = Math.floor((endIndex / allMatchups.length) * 100);
                $(".progress-bar").css("width", percentComplete + "%");
                $(".progress-text").text("Processing matchups: " + percentComplete + "% complete");
                $(".teams-processed").text(endIndex + " of " + allMatchups.length + " matchups processed");
                
                // If more matchups to process, continue in next batch
                if (endIndex < allMatchups.length) {
                    setTimeout(function() {
                        processMatchupBatch(endIndex, allMatchups, battleResults, callback);
                    }, 0);
                } else {
                    // All matchups processed, start team evaluation
                    console.log("All matchups processed, starting team evaluation");
                    console.log("Battle results contain " + Object.keys(battleResults).length + " entries");
                    callback();
                }
            }
            
            // Process teams in batches
            function processTeamBatch(startIndex, teams, battleResults, allPokemon, teamResults, callback) {
                var batchSize = 20;
                var endIndex = Math.min(startIndex + batchSize, teams.length);
                
                for (var i = startIndex; i < endIndex; i++) {
                    var team = teams[i];
                    var threatScore = calculateThreatScore(team, battleResults, allPokemon);
                    
                    
                    // Only store pokemon names and threat score for memory efficiency
                    teamResults.push({
                        pokemon: team,
                        threatScore: threatScore
                    });
                }
                
                // Update progress
                var percentComplete = Math.floor((endIndex / teams.length) * 100);
                $(".progress-bar").css("width", percentComplete + "%");
                $(".progress-text").text("Evaluating teams: " + percentComplete + "% complete");
                $(".teams-processed").text(endIndex + " of " + teams.length + " teams processed");
                
                // If more teams to process, continue in next batch
                if (endIndex < teams.length) {
                    setTimeout(function() {
                        processTeamBatch(endIndex, teams, battleResults, allPokemon, teamResults, callback);
                    }, 0);
                } else {
                    // All teams processed, rank and prepare results
                    var rankedTeams = rankTeams(teamResults);
                    callback(rankedTeams);
                }
            }

            // Run a battle between two Pokemon with specific shield counts for each
            function runBattle(pokemon1, pokemon2, shield1, shield2){
                // Set default shield values if not provided
                shield1 = (typeof shield1 !== 'undefined') ? shield1 : 1;
                shield2 = (typeof shield2 !== 'undefined') ? shield2 : shield1; // Default to shield1 if shield2 not specified
                
                var battle = new Battle();
                var poke1 = new Pokemon(pokemon1, 0, battle);
                var poke2 = new Pokemon(pokemon2, 0, battle);
                var formatValue = $(".format-select").val();
                var cupValue = $(".format-select option:selected").attr("cup") || "all";
                var cp = parseInt(formatValue) || 1500;

                poke1.initialize(cp);
                poke1.selectRecommendedMoveset("overall");
                poke1.setShields(shield1);

                poke2.initialize(cp);
                poke2.selectRecommendedMoveset("overall");
                poke2.setShields(shield2);

                battle.setCP(cp);
                battle.setCup(cupValue);

                battle.setNewPokemon(poke1, 0, false);
                battle.setNewPokemon(poke2, 1, false);
                
                battle.simulate();

                var poke1rating = battle.getBattleRatings()[0];
                var poke2rating = battle.getBattleRatings()[1];

                return {
                    poke1rating,
                    poke2rating
                };
            }

            // Get all Pokemon for the selected format/cup
            function getAllPokemon(gm){
                var allPokemon = [];
                var topPokemon = [];

                var formatValue = $(".format-select").val();
				var cupValue = $(".format-select option:selected").attr("cup") || "all";

                var key = cupValue + "overall" + formatValue;
				var rankings = gm.rankings[key];

                for(var i = 0; i < rankings.length; i++){
                    if (i < 100){ // Only consider top 100 for battles
                        allPokemon.push(rankings[i].speciesId);
                    }
                    if(i < 40){ // Use top 40 for team generation
                        topPokemon.push(rankings[i].speciesId);
                    }
                }

                return {
                    allPokemon,
                    topPokemon
                };
            }

            // Generate all possible matchups between Pokemon - including self-matchups if enabled
            function generateMatchups(allPokemon, allowSelfMatchups) {
                // Default to false if not specified
                allowSelfMatchups = (typeof allowSelfMatchups !== 'undefined') ? allowSelfMatchups : false;
                
                if (allowSelfMatchups) {
                    // If we allow self matchups, we need to handle them differently
                    return generatePairs(allPokemon);
                } else {
                    // Use regular combinations (no repeats) if self-matchups are not allowed
                    return self.generateCombinations(allPokemon, 2);
                }
            }

            // Generate all pairs (including self-matchups) from an array
            function generatePairs(arr) {
                var pairs = [];
                
                for (var i = 0; i < arr.length; i++) {
                    for (var j = 0; j < arr.length; j++) {
                        // Include all combinations (both A vs B and B vs A)
                        // This will include self-matchups (A vs A) when i === j
                        pairs.push([arr[i], arr[j]]);
                    }
                }
                
                console.log("Generated " + pairs.length + " pairs (including self-matchups)");
                return pairs;
            }

            // Generate all possible teams from top Pokemon
            function generateTeams(topPokemon){
                var teams = self.generateCombinations(topPokemon, 3);
                return teams;
            }

            // Calculate threat score for a team with all shield scenarios
            function calculateThreatScore(team, battleResults, allPokemon){
                var threatScores = [];
                
                // Define all shield scenarios
                var shieldScenarios = [
                    {atk: 0, def: 0},
                    {atk: 0, def: 1},
                    {atk: 0, def: 2},
                    {atk: 1, def: 0},
                    {atk: 1, def: 1},
                    {atk: 1, def: 2},
                    {atk: 2, def: 0},
                    {atk: 2, def: 1},
                    {atk: 2, def: 2}
                ];

                // Process each opponent Pokemon
                for (var i = 0; i < allPokemon.length; i++){
                    // Store scores for each shield scenario
                    var scenarioScores = [];
                    
                    // Process each shield scenario
                    for (var s = 0; s < shieldScenarios.length; s++) {
                        var scenario = shieldScenarios[s];
                        var keyFormat = scenario.atk + "_" + scenario.def + "_";
                        
                        var thisScenarioScore = 0;
                        var validMatchups = 0;

                        // For each Pokemon in our team
                        for(var j = 0; j < team.length; j++){
                            // Check matchup with this shield configuration
                            var key = keyFormat + team[j] + "_" + allPokemon[i];
                            if (battleResults[key] !== undefined) {
                                // Only log a few results to avoid flooding console
                                // if (i < 3) {
                                //     console.log(key + " has a threat score of " + battleResults[key]);
                                // }
                                thisScenarioScore += battleResults[key];
                                validMatchups++;
                            }
                        }
                        
                        // Calculate average score for this shield scenario
                        if (validMatchups > 0) {
                            scenarioScores.push({
                                scenario: scenario.atk + "," + scenario.def,
                                score: thisScenarioScore / validMatchups
                            });
                        }
                    }
                    
                    // Average all shield scenarios
                    if (scenarioScores.length > 0) {
                        var totalScore = 0;
                        for (var s = 0; s < scenarioScores.length; s++) {
                            totalScore += scenarioScores[s].score;
                        }
                        var avgScore = totalScore / scenarioScores.length;
                        // console.log(allPokemon[i] + " has a threat score of " + avgScore);
                        threatScores.push(avgScore);
                    }
                }

                // Sort threat scores in descending order (higher is worse)
                threatScores.sort(function(a, b) { return b - a; });
                
                // Return the mean of the 20 highest threat scores
                var count = Math.min(20, threatScores.length);
                if (count === 0) return 0;
                
                var sum = 0;
                for (var i = 0; i < count; i++) {
                    sum += threatScores[i];
                }
                return Math.round(sum / count * 1000) / 1000;
            }

            // Rank teams by their threat score
            function rankTeams(teamResults){
                // Sort by threat score (lowest to highest)
                teamResults.sort(function(a, b) {
                    return a.threatScore - b.threatScore;
                });
                
                return teamResults;
            }

            // Display the ranked teams in the UI - Include info about shield scenarios
            function displayResults(rankedTeams){
                console.log("All teams processed, displaying results");
                
                // Reset button text
                $(".evaluate-all-teams-btn .btn-label").html("Find Best Teams");
                
                // Display the top 100 teams
                var numToShow = Math.min(100, rankedTeams.length);
                var html = '<h3>Top ' + numToShow + ' Teams (Lowest Threat Score)</h3>';
                html += '<p class="center">Threat scores calculated using all 9 possible shield scenarios (0-0, 0-1, 0-2, 1-0, 1-1, 1-2, 2-0, 2-1, 2-2)</p>';
                html += '<table class="teams-table rating-table" cellspacing="0">';
                html += '<thead><tr><th>Rank</th><th>Team</th><th>Threat Score</th></tr></thead><tbody>';
                
                for (var i = 0; i < numToShow; i++) {
                    var result = rankedTeams[i];
                    
                    // Get Pokemon names for display
                    var teamStr = '';
                    for (var j = 0; j < result.pokemon.length; j++) {
                        // Convert species ID to proper name
                        var speciesId = result.pokemon[j];
                        var pokemon = new Pokemon(speciesId, 0, battle);
                        teamStr += pokemon.speciesName;
                        
                        if (j < result.pokemon.length - 1) {
                            teamStr += ', ';
                        }
                    }
                    
                    html += '<tr>';
                    html += '<td>' + (i + 1) + '</td>';
                    html += '<td>' + teamStr + '</td>';
                    html += '<td>' + result.threatScore + '</td>';
                    html += '</tr>';
                }
                
                html += '</tbody></table>';
                
                // Display results
                $(".section.typings .rankings-container").html(html);
                
                // Free memory
                rankedTeams = null;
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
