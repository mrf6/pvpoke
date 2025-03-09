var InterfaceMaster = (function () {
    var instance;

    function createInstance() {
        var object = new interfaceObject();

		function interfaceObject(){
			var gm;
			var battle;
			var results; // Store team matchup results for later reference
			var altRankings; // Store alternatives for searching
			var counterTeam;
			var self = this;
			var runningResults = false;
			var host = window.location.hostname;

			this.context = "team";

			this.init = function(){
				gm = GameMaster.getInstance();
				battle = new Battle();
			};

			// Add a method to calculate team effectiveness
			this.calculateTeamEffectiveness = function() {
				console.log("Calculating team effectiveness");

				// Initialize variables
				var histograms = [];
				var scorecardCount = 20; // Default value for scorecard length
				var allowShadows = true;
				var allowXL = true;
				var baitShields = true;

				// Hide error message
				$(".section.error").hide();

				// Get team and validate results
				var team = []; // MANUALLY SET TEAM IN THE CODE
				var gm = GameMaster.getInstance();
				var battle = new Battle();
				
				// Set up battle parameters
				battle.setCP(1500); // Set to Great League by default, can be changed
				battle.setCup("all"); // Set cup to "all" by default, can be changed

				// Make sure ranking data is loaded for recommended movesets
				var key = battle.getCup().name + "overall" + battle.getCP();
				if (!gm.rankings[key]) {
					// Instead of returning false, store a reference to this for callback
					var self = this;
					gm.loadRankingData({
						displayRankingData: function() {
							console.log("Ranking data loaded, continuing team calculation");
							// Continue team calculation from here
							self.continueTeamCalculation(team, battle, gm, histograms, scorecardCount, allowShadows, allowXL, baitShields);
							// Reset the button text now that calculation is complete
							$(".generate-rankings-btn .btn-label").html("Generate Rankings");
						}
					}, "overall", battle.getCP(), battle.getCup().name);
					console.log("Loading ranking data for movesets");
					return false;
				}

				// If ranking data is already loaded, continue directly
				return this.continueTeamCalculation(team, battle, gm, histograms, scorecardCount, allowShadows, allowXL, baitShields);
			}

			// Split out the rest of the calculation into a separate function
			this.continueTeamCalculation = function(team, battle, gm, histograms, scorecardCount, allowShadows, allowXL, baitShields) {
				// Manually add three Pokémon to the team with recommended movesets
				
				// Pokemon 1: Azumarill
				var poke1 = new Pokemon("wigglytuff", 0, battle);
				poke1.initialize(battle.getCP());
				poke1.selectRecommendedMoveset("overall"); // Use recommended moveset
				team.push(poke1);
				
				// Pokemon 2: Medicham
				var poke2 = new Pokemon("dusclops", 0, battle);
				poke2.initialize(battle.getCP());
				poke2.selectRecommendedMoveset("overall"); // Use recommended moveset
				team.push(poke2);
				
				// Pokemon 3: Skarmory
				var poke3 = new Pokemon("furret", 0, battle);
				poke3.initialize(battle.getCP());
				poke3.selectRecommendedMoveset("overall"); // Use recommended moveset
				team.push(poke3);

				if(team.length == 0){
					$(".section.error").show();
					return false;
				}

				// Process defensive and offensive matchups
				var defenseArr = [];
				var offenseArr = [];

				for(var i = 0; i < team.length; i++){
					var poke = team[i];

					defenseArr.push(
						{
							name: poke.speciesName,
							type: poke.types[0],
							matchups: this.getTypeEffectivenessArray(poke.types, "defense")
						});

					// Gather offensive matchups for fast move
					offenseArr.push(
						{
							name: poke.fastMove.name,
							type: poke.fastMove.type,
							matchups: this.getTypeEffectivenessArray([poke.fastMove.type], "offense")
						});

					// Gather offensive matchups for all charged moves
					for(var n = 0; n < poke.chargedMoves.length; n++){
						offenseArr.push(
							{
								name: poke.chargedMoves[n].name,
								type: poke.chargedMoves[n].type,
								matchups: this.getTypeEffectivenessArray([poke.chargedMoves[n].type], "offense")
							});
					}
				}

				// Display data
				$(".typings").show();

				this.displayArray(defenseArr, "defense");
				this.displayArray(offenseArr, "offense");
				this.generateSummaries(defenseArr, offenseArr);

				// Generate counters and display
				var shieldMode = "average";
				var shieldCount = 1;

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

				// IMPORTANT: Set recommended movesets to be used for ALL Pokémon in the rankings
				ranker.setRecommendMoveUsage(true);

				// Rank team against potential threats
				// This will use recommended movesets for all opponent Pokémon in the analysis
				var data = ranker.rank(team, battle.getCP(), battle.getCup(), [], "team-counters");
				var counterRankings = data.rankings;
				var teamRatings = data.teamRatings;
				counterTeam = [];

				results = counterRankings;

				// For each Pokemon in the rankings, ensure it has the recommended moveset
				for(var i = 0; i < counterRankings.length; i++){
					var pokemon = counterRankings[i].pokemon;
					
					// Reset and select recommended moveset to be absolutely certain
					pokemon.resetMoves();
					pokemon.selectRecommendedMoveset("overall");
				}

				// Double-check team Pokémon have their recommended movesets
				for(var i = 0; i < team.length; i++){
					team[i].resetMoves();
					team[i].selectRecommendedMoveset("overall");
				}

				// Potential threats
				var csv = ','; // CSV data of all matchups
				$(".section.typings .rankings-container").html('');
				$(".threats-table").html("");
				$(".meta-table").html("");

				var $row = $("<thead><tr><td></td></tr></thead>");

				for(var n = 0; n < team.length; n++){
					$row.find("tr").append("<td class=\"name-small\">"+team[n].speciesName+"</td>");

					csv += team[n].speciesName + ' ' + team[n].generateMovesetStr();
					if(n < team.length -1){
						csv += ',';
					}
				}

				csv += ',Threat Score,Overall Rating';

				$(".threats-table").append($row);
				$(".meta-table").append($row.clone());
				$(".threats-table").append("<tbody></tbody>");
				$(".meta-table").append("<tbody></tbody>");

				var avgThreatScore = 0;
				var count = 0;
				var total = scorecardCount;
				var excludedThreatIDs = [];
				var allowShadows = true; // Shadow Pokémon are allowed by default

				var i = 0;

				// Sorting threats by score (this is done by the TeamRanker but we'll do it again to be sure)
				counterRankings.sort((a,b) => (a.score > b.score) ? -1 : ((b.score > a.score) ? 1 : 0));

				while((count < total) && (i < counterRankings.length)){
					var r = counterRankings[i];

					// Make sure this threat has recommended moveset
					r.pokemon.resetMoves();
					r.pokemon.selectRecommendedMoveset("overall");

					// Filtering logic identical to TeamInterface
					// Skip shadows if not allowed
					if((r.speciesId.indexOf("_shadow") > -1) && (!allowShadows)){
						i++;
						continue;
					}

					// Skip XS forms
					if(r.speciesId.indexOf("_xs") > -1){
						i++;
						continue;
					}

					// Skip Pokémon with teambuilderexclude tag
					if(r.pokemon.hasTag("teambuilderexclude")){
						i++;
						continue;
					}

					// Skip Pokémon in the excluded IDs list
					if(excludedThreatIDs.indexOf(r.speciesId) > -1){
						i++;
						continue;
					}

					var pokemon = r.pokemon;

					// Display threat score
					if(count < 20){
						avgThreatScore += r.score;
					}

					// Push to counter team
					if(count < 6){
						counterTeam.push(pokemon);
					}

					// Add results to threats table
					$row = $("<tr><th class=\"name\"><b>"+(count+1)+". "+pokemon.speciesName+"</b></th></tr>");

					for(var n = 0; n < r.matchups.length; n++){
						var $cell = $("<td><a class=\"rating\" href=\"#\" target=\"blank\"><span></span></a></td>");
						var rating = r.matchups[n].rating;

						$cell.find("a").addClass(battle.getRatingClass(rating));

						// Make sure both Pokémon have recommended movesets before generating battle link
						pokemon.resetMoves();
						pokemon.selectRecommendedMoveset("overall");
						
						r.matchups[n].opponent.resetMoves();
						r.matchups[n].opponent.selectRecommendedMoveset("overall");

						if(!baitShields){
							pokemon.isCustom = true;
							pokemon.baitShields = 0;
							r.matchups[n].opponent.isCustom = true;
							r.matchups[n].opponent.baitShields = 0;
						}

						var pokeStr = pokemon.generateURLPokeStr();
						var moveStr = pokemon.generateURLMoveStr();
						var opPokeStr = r.matchups[n].opponent.generateURLPokeStr();
						var opMoveStr = r.matchups[n].opponent.generateURLMoveStr();
						var shieldStr = shieldCount + "" + shieldCount;
						var battleLink = host+"battle/"+battle.getCP(true)+"/"+pokeStr+"/"+opPokeStr+"/"+shieldStr+"/"+moveStr+"/"+opMoveStr+"/";
						$cell.find("a").attr("href", battleLink);

						$row.append($cell);
					}

					i++;
					count++;

					$(".threats-table tbody").append($row);
				}

				// Display average threat score
				avgThreatScore = Math.round(avgThreatScore / 20);
				$(".threat-score").html(avgThreatScore);

				// Update page title with team name
				var teamNameStr = team[0].speciesName;
				var i = 1;

				for(i = 1; i < Math.min(team.length, 3); i++){
					teamNameStr += ", " + team[i].speciesName;
				}

				if(i < team.length){
					teamNameStr += "+" + (team.length - i);
				}

				document.title = teamNameStr + " - Team Generator | PvPoke";

				// Set share link
				var cupStr = battle.getCup().name;
				var link = host + "team-generator/";

				$(".share-link input").val(link);
				
				return true;
			}


			// Display array of Pokemon matchups
			this.displayArray = function(arr, direction){
				var $container = $("."+direction);
				$container.html("");

				// Generate type headers
				var types = this.getAllTypes();
				var $row = $("<div class=\"type-row header\"></div>");

				for(var i = 0; i < types.length; i++){
					$row.append("<div class=\"type-container\"><div class=\"type " + types[i].toLowerCase() + "\">" + types[i] + "</div></div>");
				}

				$container.append($row);

				// Generate arr rows
				for(var i = 0; i < arr.length; i++){
					var obj = arr[i];
					var effectiveness = obj.matchups;

					$row = $("<div class=\"type-row\"><div class=\"name-container\"><span>" + obj.name + "</span><div class=\"type " + obj.type.toLowerCase() + "\">" + obj.type + "</div></div></div>");

					// Add individual type cells
					for(var n = 0; n < types.length; n++){
						var $cell = $("<div class=\"type-container\"></div>");
						var effectivenessValue = effectiveness[n];
						var effectivenessClass = "";
						var effectivenessLabel = "x" + effectivenessValue;

						if(effectivenessValue > 1){
							effectivenessClass = "se";

							if(effectivenessValue >= 2.5){
								effectivenessClass = "se se-4";
							} else if(effectivenessValue >= 2){
								effectivenessClass = "se se-3";
							} else if(effectivenessValue >= 1.6){
								effectivenessClass = "se se-2";
							}
						} else if(effectivenessValue < 1){
							effectivenessClass = "nve";

							if(effectivenessValue <= 0.39){
								effectivenessClass = "nve nve-4";
							} else if(effectivenessValue <= 0.5){
								effectivenessClass = "nve nve-3";
							} else if(effectivenessValue <= 0.625){
								effectivenessClass = "nve nve-2";
							}
						}

						if(parseFloat(effectivenessValue) == 0){
							effectivenessClass = "immune";
							effectivenessLabel = "x0";
						}

						$cell.append("<div class=\"type-effectiveness " + effectivenessClass + "\">" + effectivenessLabel + "</div>");
						$row.append($cell);
					}

					$container.append($row);
				}
			}

			// Generate summaries of a team's typing matchups
			this.generateSummaries = function(defenseArr, offenseArr){
				var defSummary = [];
				var offSummary = [];

				defSummary = this.generateTypeSummary(defenseArr, defSummary, "defense");
				offSummary = this.generateTypeSummary(offenseArr, offSummary, "offense");
				
				$(".defense-summary").html("");
				$(".offense-summary").html("");

				for(var i = 0; i < defSummary.length; i++){
					$(".defense-summary").append("<div class=\"summary-item\">"+defSummary[i]+"</div>");
				}

				for(var i = 0; i < offSummary.length; i++){
					$(".offense-summary").append("<div class=\"summary-item\">"+offSummary[i]+"</div>");
				}
			}

			// Given a subject type, produce effectiveness array for offense or defense
			this.getTypeEffectivenessArray = function(subjectTypes, direction){
				var arr = [];
				var battle = new Battle();
				var allTypes = this.getAllTypes();

				for(var n = 0; n < allTypes.length; n++){

					if(direction == "offense"){
						var effectiveness = battle.getEffectiveness(subjectTypes[0], [allTypes[n]]);

						// Round to nearest thousandths to avoid Javascript floating point wonkiness
						effectiveness = Math.floor(effectiveness * 1000) / 1000;

						arr.push(effectiveness);
					} else if(direction == "defense"){
						effectiveness = battle.getEffectiveness(allTypes[n], subjectTypes);

						// Round to nearest thousandths to avoid Javascript floating point wonkiness
						effectiveness = Math.floor(effectiveness * 1000) / 1000;

						arr.push(effectiveness);
					}
				}

				return arr;
			}

			// Array of all types
			this.getAllTypes = function(){
				var types = ["Bug","Dark","Dragon","Electric","Fairy","Fighting","Fire","Flying","Ghost","Grass","Ground","Ice","Normal","Poison","Psychic","Rock","Steel","Water"];

				return types;
			}

			// Return an array of descriptions given an array of type effectiveness, and a flag for offense or defense
			this.generateTypeSummary = function(arr, sumArr, direction){
				var typesResistedArr = [];
				var typesWeakArr = [];
				var typesNeutralOrBetter = []; // Array of types that can be hit for neutral damage or better
				var productArr = []; // Product of resistances across all Pokemon

				var allTypes = this.getAllTypes();

				for(var i = 0; i < allTypes.length; i++){
					typesResistedArr.push(0);
					typesWeakArr.push(0);
					typesNeutralOrBetter.push(0);
					productArr.push(1);
				}

				for(var i = 0; i < arr.length; i++){
					var obj = arr[i];

					for(var n = 0; n < obj.matchups.length; n++){

						if(obj.matchups[n] < 1){
							typesResistedArr[n] = 1;
						} else if (obj.matchups[n] > 1){
							typesWeakArr[n] = 1;
						}

						if(obj.matchups[n] >= 1){
							typesNeutralOrBetter[n] = 1;
						}

						productArr[n] *= obj.matchups[n];
					}
				}
				// Produce a final defensive count

				var typesResisted = 0;
				var typesWeak = 0;
				var overallStrengths = [];
				var overallWeaknesses = [];
				var overallNoNeutralDamage = [];

				for(var i = 0; i < allTypes.length; i++){
					if(typesResistedArr[i] == 1){
						typesResisted++;
					}

					if(typesWeakArr[i] == 1){
						typesWeak++;
					}

					if(typesNeutralOrBetter[i] == 0){
						overallNoNeutralDamage.push(allTypes[i]);
					}

					if(productArr[i] < 1){
						overallStrengths.push(allTypes[i]);
					} else if(productArr[i] > 1){
						overallWeaknesses.push(allTypes[i]);
					}
				}

				if(direction == "defense"){
					sumArr.push("This team resists " + typesResisted + " of " + allTypes.length + " types.");
					sumArr.push("This team is weak to " + typesWeak + " of " + allTypes.length + " types.");
				} else if(direction == "offense"){
					sumArr.push("This team can hit " + typesWeak + " of " + allTypes.length + " types super effectively.");
				}

				var str;

				// On defense show which types are best resisted, and on offense show which types are best hit effectively

				if(overallStrengths.length > 0){
					if(direction=="defense"){
						str = this.generateTypeSummaryList(overallStrengths, "Overall, strong against","");
					} else if(direction=="offense"){
						str = this.generateTypeSummaryList(overallWeaknesses, "Overall, most effective against","");
					}

					sumArr.push(str);
				}

				// On defense, show list of types that hit this team most effectively

				if((overallWeaknesses.length > 0) && (direction == "defense")){
					str = this.generateTypeSummaryList(overallWeaknesses, "Overall, weak to","");

					sumArr.push(str);
				}

				// On offense, show list of types that can't be hit with neutral or better damage

				if((overallNoNeutralDamage.length > 0) && (direction == "offense")){
					str = this.generateTypeSummaryList(overallNoNeutralDamage, "This team can't hit", " for at least neutral damage.");

					sumArr.push(str);
				}

				return sumArr;
			}

			// Generate and return a descriptive string given a list of types
			this.generateTypeSummaryList = function(arr, beforeStr, afterStr){
				var str = beforeStr;

				for(var i = 0; i < arr.length; i++){
					if(i > 0){
						str += ",";

						if((i == arr.length - 1) && (i > 1)){
							str += " and";
						}
					}

					str += " <span class=\"" + arr[i].toLowerCase() + "\">" + arr[i] + "</span>";
				}

				str += afterStr;

				return str;
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
