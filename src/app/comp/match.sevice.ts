import {Injectable, NgZone, OnInit} from '@angular/core';
import {IMatch} from '../../../models/match.models';
import {Subject, Subscription} from 'rxjs';
import {IStats} from '../../../models/stats.model';
import {IMatches} from '../../../models/matches.model';
import {CompetitionService} from './competition.service';

declare var Opta: any;

@Injectable({
  providedIn: 'root'
})
export class MatchService {

  match: IMatch[];
  matchSubject = new Subject<IMatch[]>();
  start: any;
  end: any;
  TRANS: [any];
  eventTrans = {
    aerial_duels: 5181,
    aerial_duels_accuracy: 121,
    assists: 4351,
    attack: 4301,
    ball_recoveries: 8261,
    ball_recoveries_attacking: 17421,
    ball_recoveries_attacking_accuracy: 17451,
    ball_recoveries_defensive: 17401,
    ball_recoveries_midfield: 17411,
    cards_red: 4361,
    cards_yellow: 4371,
    clearances: 4401,
    corners: 4411,
    corners_won: 8611,
    crosses: 4421,
    crosses_accuracy: 4431,
    crosses_claimed_successful: 8301,
    crosses_claimed_unsuccessful: 4441,
    defence: 4311,
    discipline: 4331,
    distribution: 4321,
    dribbles_success: 5011,
    drops: 5151,
    duels: 4451,
    duels_accuracy: 4461,
    final_thirds_entries: 11701,
    fouls_conceded: 4481,
    fouls_won: 4471,
    general: 4511,
    goalkeeping: 4341,
    goals: 4491,
    interceptions: 4501,
    key_passes: 5021,
    minutes_played: 4771,
    no_data: 441,
    offsides: 4741,
    open_play_crosses: 5681,
    passes: 4521,
    passes_accuracy: 4531,
    passes_final_third: 11811,
    passes_final_third_accuracy: 11681,
    passes_forward: 17431,
    passes_forward_accuracy: 17441,
    passes_long: 4591,
    passes_long_proportion: 12701,
    passes_opponents_half: 5401,
    passes_opponents_half_accuracy: 4541,
    penalty_area_entries: 11691,
    possession: 4611,
    possession_lost: 12011,
    possession_lost_defensive: 17461,
    possession_lost_midfield: 17471,
    punches: 5301,
    saves_total: 4621,
    shots: 4631,
    shots_accuracy: 4641,
    shots_accuracy_excluding_blocked_shots: 14171,
    shots_blocked: 4651,
    shots_faced_goalkeeper: 4661,
    shots_faced_on_target: 14481,
    shots_headed: 11821,
    shots_inside_box: 4671,
    shots_on_target: 4691,
    shots_outside_box: 4681,
    shots_saved: 14491,
    sweeper_keeper: 6151,
    sweeper_keeper_accuracy: 14431,
    tackles: 4701,
    tackles_accuracy: 4711,
    through_balls: 11711,
    title: 4291,
    touches: 4731,
    dfl_duels: 4451,
    expectedassists: 17491,
    expectedgoals: 15121,
    final_third_entries: 11701,
    possession_won_attacking_3rd: 17421,
    possession_won_middle_3rd : 17411,
    possession_won_defensive_3rd: 17401

  };
  stats: IStats[];
  statsSubject = new Subject<IStats[]>();
  matches: IMatches[];
  stats$ = this.statsSubject.asObservable();

  constructor() {}


  emitStats() {
    this.statsSubject.next(this.stats);
  }

  emitMatch() {
    this.matchSubject.next(this.match);
  }

  getSummarisedStats(events) {
    const passes = events.filter((e) => {
      return e.type_id === 1 && e.outcome;
    });

    const badPasses = events.filter((e) => {
      return e.type_id === 1 && !e.outcome;
    });

    const shots = events.filter((e) => {
      return e.type_id === 13 || e.type_id === 14 || e.type_id === 15 || e.type_id === 16;
    });

    const sot = shots.filter((e) => {
      const typeId = e.type_id === 14 || e.type_id === 15 || e.type_id === 16;
      const q = e.q['82'] || e.q['28'] || e.q['26'] || e.q['9'];
      return typeId && !q;
    });

    const fouls = events.filter((e) => {
      return e.type_id === 4;
    });
    const pass80 = events.filter((e) => {
      return e.type_id === 1 && e.outcome && e.x > 80;
    });

    const pass70 = events.filter((e) => {
      return e.type_id === 1 && e.outcome && e.x > 70;
    });

    const corners = events.filter((e) => {
      return e.type_id === 6;
    });

    const cards = events.filter((e) => {
      return e.type_id === 17;
    });

    const duelWon = events.filter((e) => {
      const duel = e.type_id === 74 || e.type_id === 49 || e.type_id === 8 || e.type_id === 52;
      return duel && e.outcome;
    });
    const duelLost = events.filter((e) => {
      const duel = e.type_id === 74 || e.type_id === 49 || e.type_id === 8 || e.type_id === 52;
      return duel && !e.outcome;
    });

    return {
      passes,
      badPasses,
      pass80,
      pass70,
      shots,
      sot,
      corners,
      fouls,
      cards,
      duelWon,
      duelLost
    };
  }

  uniqueBy(a, key) {
    const seen = new Set();
    return a.filter(item => {
      const k = key(item);
      return seen.has(k) ? false : seen.add(k);
    });
  }

  getMatchData = (matchId, competitionId, seasonId, dataType) => {
    this.stats = [];
    return new Promise(
      (resolve, reject) => {
        Opta.api.getFootballMatch({
          origin: 'OW',
          params: {
            data_type: dataType,
            competition_id: competitionId,
            season_id: seasonId,
            match_id: matchId,
            trn: {
              teams: true,
              comps: true
            },
            live: false,
            max_age: 30
          },
          done: (data) => {
            const match = data.match;
            /* events.forEach(e => {

               if (e.hasQ(321)) {
                 e.qualifiers[321].locale_value = Opta.NumberFormatter.format(
                   e.qualifiers[321].value,
                   {minimumFractionDigits: 2, style: 'percent'}
                 );
               }
             }).then();*/
            this.start = { period : {id: 2}, min: 0, sec: 0};
            this.end = { period: {id: 2}, min: 40, sec: 0};
            this.match = match;
            this.stats.push({
              clock: undefined, match_time: 0, period: '', period_timestamps: undefined,
              id: match.id,
              home: {
                id: match.home.id,
                stats: match.home.stats,
                score: match.home.score,
                logo: null
              },
              away: {
                id: match.away.id,
                stats: match.away.stats,
                score: match.away.score,
                logo: null
              },
              goals : null
            });

            const mat = this.matches.filter(m => {
              return m.id === matchId;
            });

            const e = Opta.extend(mat, {
              home: {
                stats: match.home.stats
              },
              away: {
                stats: match.away.stats
              }
            });

            console.log(e);





            this.emitStats();
            /*console.log(this.uniqueBy(eventType.sort((a, b) => {
              return a - b;
            }), JSON.stringify));*/

            // console.log(this.uniqueBy(eventType.sort((a, b) => {return a - b}), JSON.stringify));

            /*
            const sumData = this.getSummarisedStats(match.events);
            console.log(sumData);
            */



       //     console.log(this.match);
           /* console.log(match.getEventStats({
              start: {period: {id: 2}, min: 0, sec: 0},
              end: {period: {id: 12}, min: 0, sec: 0},
              teams: !0}));
           */
          },
          fail: (error) => {
            console.log(error);
          }
        }).then(
          (data) => {
            resolve(data);
          },
          (error) => {
            reject(error);
          }
        );
      });
  }



  getEventStatsByInterval(match) {
   match.getEventStats( {
      start: {period: {id: 2}, min: 0, sec: 0},
      end: {period: {id: 4}, min: 60, sec: 0},
      teams: !0
    });
  }

  loadTranslations() {
    Opta.Trans.loadTerms({
      term_set_id: Opta.Trans.mapSportIdToTerms(1)
    }).then(
      this.TRANS = Opta.Trans.getText(this.eventTrans)
    );

    //this.TRANS = Opta.Trans.data.terms;
    this.TRANS = Opta.Trans.getText(this.eventTrans);
    //console.log(Opta.Trans.data.terms)

    //console.log(this.TRANS);
  }

}
