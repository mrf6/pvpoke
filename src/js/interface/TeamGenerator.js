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
            const NUM_BATTLE_POKEMON = 100;
            const NUM_TEAM_POKEMON = 100;
			// Define all shield scenarios globally
			const SHIELD_SCENARIOS = [
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

			// Global variables
			var gm;
			var battle;
            var battleResults;
			var results; // Store team matchup results for later reference
			var rankingData = null; // Store ranking data centrally
			var pokemonMap = {}; // Map of Pokémon IDs to names
			var selectedPokemon = []; // Track selected Pokémon for includes
			var self = this;
			var host = window.location.hostname;

			this.context = "team";

			// Initialize the interface
			this.init = function(){
				gm = GameMaster.getInstance();
				battle = new Battle();
				
				// Initial configuration of battle
				configureBattle();
				
				// Set up event handlers for format changes
				$(".format-select").on("change", function() {
					// Clear ranking data when format changes
					rankingData = null;
					pokemonMap = {};
					
					// Configure battle with new format
					configureBattle();
					
					// Load ranking data for the new format
					loadRankingData(function() {
						console.log("Ranking data loaded for new format");
					});
				});
				
				// Initial load of ranking data
				loadRankingData(function() {
					console.log("Initial ranking data loaded");
				});
			};
			
			// Centralized function to load ranking data
			function loadRankingData(callback) {
				if (rankingData !== null) {
					// Data already loaded, just return it
					if (callback) callback(rankingData);
					return;
				}
				
				// Make sure battle is configured
				if (!battle.getCup() || !battle.getCP()) {
					configureBattle();
				}
				
				// Get the key for the current format/cup
				var cupName = battle.getCup() ? battle.getCup().name : "all";
				var cp = battle.getCP() || 1500;
				var key = cupName + "overall" + cp;
				
				if (!gm.rankings[key]) {
					// Need to load data from server
					gm.loadRankingData({
						displayRankingData: function() {
							rankingData = gm.rankings[key];
							
							// Build Pokémon map for easy lookup
							buildPokemonMap();
							
							if (callback) callback(rankingData);
						}
					}, "overall", cp, cupName);
				} else {
					// Data already in GameMaster, use it
					rankingData = gm.rankings[key];
					
					// Build Pokémon map for easy lookup
					buildPokemonMap();
					
					if (callback) callback(rankingData);
				}
			}
			
			// Build map of Pokémon IDs to names for easier lookup
			function buildPokemonMap() {
				pokemonMap = {};
				
				if (!rankingData) return;
				
				for (var i = 0; i < rankingData.length; i++) {
					var pokemon = rankingData[i];
					pokemonMap[pokemon.speciesId] = pokemon.speciesName;
				}
			}
			
			// Helper function to configure battle settings
			function configureBattle() {
				// Set up battle parameters using selected format
				var formatValue = $(".format-select").val();
				var cupValue = $(".format-select option:selected").attr("cup") || "all";
				var cp = parseInt(formatValue) || 1500;
				
				// Make sure battle is initialized
				if (!battle) {
					battle = new Battle();
				}
				
				battle.setCP(cp);
				battle.setCup(cupValue);
				
				console.log("Configured battle: CP " + cp + ", Cup: " + cupValue);
				
				return { cp, cupValue };
			}
			
			// Get top Pokémon and all Pokémon from ranking data
			function getPokemonLists(battleCount, teamCount) {
                // battleCount = battleCount || 150; // Use top 150 for all battles
				// teamCount = teamCount || 100; // Build teams from top 100
				
				var battlePokemon = [];
				var teamPokemon = [];
				
				if (!rankingData) {
					console.error("Ranking data not loaded");
					return { battlePokemon, teamPokemon };
				}
				
				for (var i = 0; i < rankingData.length; i++) {
					var speciesId = rankingData[i].speciesId;
                    
                    if (i < battleCount) {
                        battlePokemon.push(speciesId);
                    }
					
					if (i < teamCount) {
						teamPokemon.push(speciesId);
					}
				}
				
				return { battlePokemon, teamPokemon };
			}
            
            // Main function to evaluate all teams - This will be called from the button
            this.evaluateAllTeams = function() {
                console.log("Starting evaluation of all possible teams");
                
                // Update button text to show processing
                $(".evaluate-all-teams-btn .btn-label").html("Processing (this may take a while)...");
                
                // Show a loading message while we load the data
                $(".typings").show();
                $(".section.typings .rankings-container").html('<div class="processing-message"><p>Loading Pokémon data...</p></div>');
                
                // Make sure battle is configured
                if (!battle.getCup() || !battle.getCP()) {
                    configureBattle();
                }
                
                // Make sure ranking data is loaded
                loadRankingData(function() {
                    // Once data is loaded, run the team evaluation
                    if (!rankingData || !rankingData.length) {
                        // Show error if we couldn't load data
                        $(".section.typings .rankings-container").html('<div class="error-message"><p>Error: Could not load Pokémon ranking data. Please try again.</p></div>');
                        $(".evaluate-all-teams-btn .btn-label").html("Find Best Teams");
                        return;
                    }
                    
                    // Data is loaded, proceed with evaluation
                    runTeamEvaluation();
                });
                
                return true;
            };
            
            // Set up the Pokémon selection UI
            this.initializePokemonSelector = function() {
                // Function to render the include list
                function renderIncludeList() {
                    var $list = $(".include-pokemon-list");
                    $list.empty();
                    
                    for (var i = 0; i < selectedPokemon.length; i++) {
                        var pokemonId = selectedPokemon[i];
                        var displayName = pokemonMap[pokemonId] || pokemonId;
                        
                        var $item = $('<div class="include-pokemon-item" data-id="' + pokemonId + '">' + 
                                      '<span class="name">' + displayName + '</span>' + 
                                      '<span class="remove">×</span>' + 
                                      '</div>');
                        
                        $list.append($item);
                    }
                    
                    // Show/hide add button based on current selection count
                    if (selectedPokemon.length >= 3) {
                        $(".add-include-btn").hide();
                    } else {
                        $(".add-include-btn").show();
                    }
                }
                
                // Handle the Add Pokémon button click
                $(".add-include-btn").on("click", function() {
                    // Make sure data is loaded before showing modal
                    loadRankingData(function() {
                        // Show the modal
                        $(".include-search-modal").css("display", "block");
                        
                        // Focus the search input
                        $(".poke-search").focus();
                    });
                });
                
                // Close the modal when the × is clicked
                $(".close-modal").on("click", function() {
                    $(".include-search-modal").css("display", "none");
                });
                
                // Close the modal when clicking outside of it
                $(window).on("click", function(event) {
                    if ($(event.target).hasClass("modal")) {
                        $(".include-search-modal").css("display", "none");
                    }
                });
                
                // Handle the search input
                $(".poke-search").on("input", function() {
                    var query = $(this).val().toLowerCase();
                    var $results = $(".search-results");
                    
                    $results.empty();
                    
                    if (query.length < 2) return;
                    
                    var matches = [];
                    
                    // Search by ID and name
                    for (var id in pokemonMap) {
                        var name = pokemonMap[id];
                        
                        if (id.toLowerCase().includes(query) || name.toLowerCase().includes(query)) {
                            matches.push({
                                id: id,
                                name: name
                            });
                        }
                        
                        // Limit to 20 results for performance
                        if (matches.length >= 20) break;
                    }
                    
                    // Display results
                    for (var i = 0; i < matches.length; i++) {
                        var match = matches[i];
                        var $item = $('<div class="search-item" data-id="' + match.id + '">' + match.name + ' (' + match.id + ')</div>');
                        $results.append($item);
                    }
                });
                
                // Handle clicking on a search result
                $(document).on("click", ".search-item", function() {
                    var pokemonId = $(this).data("id");
                    
                    // Don't add duplicates
                    if (selectedPokemon.indexOf(pokemonId) === -1) {
                        selectedPokemon.push(pokemonId);
                        renderIncludeList();
                    }
                    
                    // Close the modal
                    $(".include-search-modal").css("display", "none");
                    $(".poke-search").val("");
                    $(".search-results").empty();
                });
                
                // Handle removing a Pokémon from the include list
                $(document).on("click", ".include-pokemon-item .remove", function() {
                    var $item = $(this).closest(".include-pokemon-item");
                    var pokemonId = $item.data("id");
                    
                    // Remove from the list
                    selectedPokemon = selectedPokemon.filter(function(id) {
                        return id !== pokemonId;
                    });
                    
                    renderIncludeList();
                });
                
                // Initialize the UI
                renderIncludeList();
            };

            // Main function that runs the team evaluation process
            function runTeamEvaluation() {
                // Make sure we have ranking data
                if (!rankingData || !rankingData.length) {
                    console.error("Cannot run team evaluation: Ranking data not loaded");
                    $(".section.typings .rankings-container").html('<div class="error-message"><p>Error: Pokémon data not available.</p></div>');
                    $(".evaluate-all-teams-btn .btn-label").html("Find Best Teams");
                    return false;
                }
                
                // Show processing information
                $(".typings").show();
                $(".section.typings .rankings-container").html('<div class="processing-message"><p>Processing all possible teams. This may take several minutes...</p><div class="progress-container"><div class="progress-bar"></div></div><p class="progress-text">0% complete</p><p class="teams-processed">0 teams processed</p></div>');
                
                // Get Pokémon lists from ranking data
                var pokemonLists = getPokemonLists(NUM_BATTLE_POKEMON, NUM_TEAM_POKEMON);
                var battlePokemon = pokemonLists.battlePokemon;
                var teamPokemon = pokemonLists.teamPokemon;
                
                console.log("Using top " + teamPokemon.length + " Pokémon to generate teams");
                
                // Get the include list from the UI
                var includeList = selectedPokemon;
                
                if (includeList.length > 0) {
                    console.log("Generating teams that include: " + includeList.join(", "));
                }
                
                // Validate include list - make sure all Pokémon are in our data
                for (var i = 0; i < includeList.length; i++) {
                    if (!pokemonMap[includeList[i]]) {
                        console.warn("Warning: Included Pokémon '" + includeList[i] + "' not found in ranking data");
                    }
                }
                
                // Generate all possible 3-Pokémon combinations with optional include list
                var teams = generateTeams(teamPokemon, includeList);
                
                if (teams.length === 0) {
                    $(".section.typings .rankings-container").html('<div class="error-message"><p>Error: No valid teams could be generated. Please check your Pokémon selection.</p></div>');
                    $(".evaluate-all-teams-btn .btn-label").html("Find Best Teams");
                    return false;
                }
                
                console.log("Generated " + teams.length + " possible team combinations");
                
                // Generate all possible matchups, INCLUDING self-matchups (same Pokemon vs itself)
                var allMatchups = generateMatchups(battlePokemon, true);
                console.log("Generated " + allMatchups.length + " possible matchups (including self-matchups)");
                
                // Process in batches to prevent UI freezing
                processBattlesInBatches(teams, allMatchups, battlePokemon);
                
                return true;
            }
            
            // Process battles in batches to keep the UI responsive
            function processBattlesInBatches(teams, allMatchups, battlePokemon) {
                var totalTeams = teams.length;
                var battleResults = {};
                var teamResults = [];
                
                console.log("Starting to process " + totalTeams + " teams in batches");
                
                // Process matchups first
                processMatchupBatch(0, allMatchups, battleResults, function() {
                    // After all matchups are processed, process teams
                    processTeamBatch(0, teams, battleResults, battlePokemon, teamResults, function(rankedTeams) {
                        // When all teams are processed, display results
                        displayResults(rankedTeams);
                    });
                });
            }
            
            // Process matchups in batches - Run all 9 possible shield scenarios
            function processMatchupBatch(startIndex, allMatchups, battleResults, callback) {
                var batchSize = 50; // Reduced batch size since we're doing nine battles per matchup
                var endIndex = Math.min(startIndex + batchSize, allMatchups.length);
                
                for (var i = startIndex; i < endIndex; i++) {
                    var matchup = allMatchups[i];
                    
                    // Run all shield scenarios
                    for (var s = 0; s < SHIELD_SCENARIOS.length; s++) {
                        var scenario = SHIELD_SCENARIOS[s];
                        
                        // Run battle with specific shield configuration
                        var result = runBattle(matchup[0], matchup[1], scenario.atk, scenario.def);
                        
                        // Create key format that includes both shield counts: "atk_def_pokemon1_pokemon2"
                        var keyFormat = scenario.atk + "_" + scenario.def + "_";
                        
                        // Store results with shield counts in the key
                        battleResults[keyFormat + matchup[1] + "_" + matchup[0]] = result.poke1rating;
                        battleResults[keyFormat + matchup[0] + "_" + matchup[1]] = result.poke2rating;
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
            function processTeamBatch(startIndex, teams, battleResults, battlePokemon, teamResults, callback) {
                var batchSize = 100;
                var endIndex = Math.min(startIndex + batchSize, teams.length);
                
                for (var i = startIndex; i < endIndex; i++) {
                    var team = teams[i];
                    var threatScore = calculateThreatScore(team, battleResults, battlePokemon);
                    
                    // Add debug log for each team's threat score
                    // if (i < 5) { // Only log first few teams to avoid console flooding
                    //     console.log("Team " + team.join(", ") + " has threat score: " + threatScore);
                    // }
                    
                    // Only store pokemon ids and threat score for memory efficiency
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
                        processTeamBatch(endIndex, teams, battleResults, battlePokemon, teamResults, callback);
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
                
                // Create a new Battle instance for this simulation
                var battleSim = new Battle();
                
                // Get current settings
                var cp = battle.getCP() || 1500;
                var cupName = battle.getCup() ? battle.getCup().name : "all";
                
                // Configure the simulation battle
                battleSim.setCP(cp);
                battleSim.setCup(cupName);
                
                var poke1 = new Pokemon(pokemon1, 0, battleSim);
                var poke2 = new Pokemon(pokemon2, 0, battleSim);

                poke1.initialize(cp);
                poke1.selectRecommendedMoveset("overall");
                poke1.setShields(shield1);

                poke2.initialize(cp);
                poke2.selectRecommendedMoveset("overall");
                poke2.setShields(shield2);

                battleSim.setNewPokemon(poke1, 0, false);
                battleSim.setNewPokemon(poke2, 1, false);
                
                battleSim.simulate();

                var poke1rating = battleSim.getBattleRatings()[0];
                var poke2rating = battleSim.getBattleRatings()[1];

                return {
                    poke1rating,
                    poke2rating
                };
            }

            // Generate all possible matchups between Pokemon - including self-matchups if enabled
            function generateMatchups(battlePokemon, allowSelfMatchups) {
                // Default to false if not specified
                allowSelfMatchups = (typeof allowSelfMatchups !== 'undefined') ? allowSelfMatchups : false;
                
                if (allowSelfMatchups) {
                    // If we allow self matchups, we need to handle them differently
                    return generatePairs(battlePokemon);
                } else {
                    // Use regular combinations (no repeats) if self-matchups are not allowed
                    return self.generateCombinations(battlePokemon, 2);
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

            // Generate all possible teams from top Pokemon with option to include specific Pokemon
            function generateTeams(teamPokemon, include) {
                // Default include to empty array if not provided
                include = include || [];
                
                if (include.length === 0) {
                    // Case 1: No Pokemon to include, generate all possible 3-Pokemon combinations
                    return self.generateCombinations(teamPokemon, 3);
                } else if (include.length === 3) {
                    // Case 4: Exactly 3 Pokemon to include, just return that team
                    return [include];
                } else {
                    // Cases 2 & 3: Include 1 or 2 specific Pokemon
                    var remainingPokemon = teamPokemon.filter(function(pokemon) {
                        // Only keep Pokemon that aren't already in the include list
                        return !include.includes(pokemon);
                    });
                    
                    var teams = [];
                    
                    if (include.length === 1) {
                        // Case 2: Include 1 specific Pokemon, need to pick 2 more
                        var additionalPairs = self.generateCombinations(remainingPokemon, 2);
                        
                        // For each pair, create a team with the included Pokemon
                        for (var i = 0; i < additionalPairs.length; i++) {
                            teams.push([include[0], additionalPairs[i][0], additionalPairs[i][1]]);
                        }
                    } else if (include.length === 2) {
                        // Case 3: Include 2 specific Pokemon, need to pick 1 more
                        for (var i = 0; i < remainingPokemon.length; i++) {
                            teams.push([include[0], include[1], remainingPokemon[i]]);
                        }
                    }
                    
                    return teams;
                }
            }

            // Calculate threat score for a team with all shield scenarios
            function calculateThreatScore(team, battleResults, battlePokemon){
                var threatScores = [];
                
                // Process each opponent Pokemon
                for (var i = 0; i < battlePokemon.length; i++){
                    // Store scores for each shield scenario
                    var scenarioScores = [];
                    
                    // Process each shield scenario
                    for (var s = 0; s < SHIELD_SCENARIOS.length; s++) {
                        var scenario = SHIELD_SCENARIOS[s];
                        var keyFormat = scenario.atk + "_" + scenario.def + "_";
                        
                        var thisScenarioScore = 0;
                        var validMatchups = 0;

                        // For each Pokemon in our team
                        for(var j = 0; j < team.length; j++){
                            // Check matchup with this shield configuration
                            var key = keyFormat + team[j] + "_" + battlePokemon[i];
                            if (battleResults[key] !== undefined) {
                                // Only log a few results to avoid flooding console
                                // if (i < 3 && j === 0 && s === 0) {
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
                        // Use the pokemon map instead of creating new Pokemon objects
                        var speciesId = result.pokemon[j];
                        var speciesName = pokemonMap[speciesId] || speciesId;
                        teamStr += speciesName;
                        
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
