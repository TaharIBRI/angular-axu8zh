import {Injectable} from '@angular/core';
import {IMatches} from '../../../models/matches.model';
import {Subject} from 'rxjs';
import {IMatch, TeamEntity} from '../../../models/match.models';
import {IStats} from '../../../models/stats.model';
import { isNumeric } from 'rxjs/util/isNumeric';

declare var Opta: any;


@Injectable({
  providedIn: 'root'
})
export class CompetitionService {
  SEASON_ID = '2019';
  matches: IMatches[] = [];
  matchesSubject = new Subject<IMatches[]>();
  match: IMatch;
  stats: IStats;
  statsSubject = new Subject<IStats>();
  live = false;
  preMatch = false;


  constructor() {

  }


  emitMatches() {
    this.matchesSubject.next(this.matches.slice());
  }

  emitStats() {
    this.statsSubject.next(this.stats);
  }


  getMatches = (competitionId: any, seasonId: any) => {
    let matches = [];
    Opta.api.getFootballCompetition({
      origin: 'OW',
      source: isNumeric(seasonId) ? 'omo' : 'sdapi',
      params: {
        competition_id: competitionId,
        season_id: seasonId,
        data_type: this.live ? ['matches', 'matches_live'] : ['matches'],
        trn: {
          comps: true,
          teams: true,
          venues: true
        },
        live: false,
        max_age: 10
      },
      done: (data) => {
       // console.log(data);
        matches = data.competition.matches.matches;

        matches = matches.sort((a, b) => {
          const ad = a.date.toDate();
          const bd = b.date.toDate();
          return Math.max(-1, Math.min(+1, ad.getTime() - bd.getTime()));
        }).reverse();
        if (this.live) {
          this.preMatch = false;
          matches = matches.filter(m => m.isLive()).reverse();
          console.log('Live matches');
        } else if (this.preMatch) {
          matches = matches.filter(m => m.isPreMatch());
          console.log('Pre matches');
        } else {
          matches = matches.filter(m => m.isFinished()).reverse();
          console.log('Finished matches');
        }
        // @ts-ignore
        this.matches = matches.map(m => {
          const ma = {
            id: m.id,
            Date: this.getDate(m),
            home: m.home,
            away: m.away,
            compId: m.competition_id,
            seasonId: m.season_id,
            matchday: m.matchday,
            status: m.isLive() ? 'live' : m.isFinished() ? 'finished' : 'prematch',
            period_timestamps: m.period_timestamps
          };
          ma.home.logo = this.getTeamImage(m.home);
          ma.away.logo = this.getTeamImage(m.away);
          return ma;
        });


        // console.log(this.matches);

        /* this.matchesSubject.next(matches);
        */


        // if (!this.preMatch) {
        //   this.matches.forEach(m => {
        //     this.getMatchesStats(m);
        //   });
        //   this.statsSubject.subscribe(stats => {
        //     this.matches.forEach(m => {
        //       if (m.id === stats.id) {
        //         m.home.stats = stats.home.stats;
        //         m.away.stats = stats.away.stats;
        //         m.home.score = stats.home.score;
        //         m.away.score = stats.away.score;
        //         m.goals = stats.goals;
        //         m.period = stats.period;
        //         m.match_time = stats.match_time;
        //         m.clock = stats.clock;
        //         m.period_timestamps = stats.period_timestamps;
        //       }
        //     });

        //   });
        // }
        this.emitMatches();
        // not live

       // console.log(this.matches);
      },
      fail: () => {
        console.log('Something went wrong ! : ');
      }
    });
  }

  getImage = (e) => {
    const iconType = e.getIconType();
    if (!iconType) { return null; }
    const { base } = Opta.AppSettings.res;
    const src = `${base}assets/images/icons/football_events/icon-${iconType}.svg`;
    return src;
  }

  getTeamImage = (a) => {
    const img = Opta.components.image({
      alt: a.toString().full,
      id: a.id,
      image_size: 'small',
      size: 'small',
      sport: 'football',
      title: a.toString().full
    });

    return img.src;
  }

  getActions(match, team: TeamEntity) {
    const teamId = team.id;
    const events = match.getTouchmapEvents();
    const teamEvents = events.filter(e => {
      return e.team_id === teamId;
    });

    const defensive = events.filter(e => {
      return e.x <= 50 && e.team_id === teamId;
    });

    const attacking = events.filter(e => {
      return e.x > 50 && e.x <= 80 && e.team_id === teamId;
    });

    const dangerous_attacks = events.filter(e => {
      return e.x > 80 && e.team_id === teamId;
    });



    const att = {
      h1:  Number(attacking.filter( e => e.period_id === 2).length * 100 / teamEvents.filter( e => e.period_id === 2).length).toFixed(0),
      h2: Number(attacking.filter( e => e.period_id === 4).length * 100 / teamEvents.filter( e => e.period_id === 4).length).toFixed(0),
      total:  Number(attacking.length * 100 / teamEvents.length).toFixed(0)

    };

    const def = {
      h1:  Number(defensive.filter( e => e.period_id === 2).length * 100 / teamEvents.filter( e => e.period_id === 2).length).toFixed(0),
      h2: Number(defensive.filter( e => e.period_id === 4).length * 100 / teamEvents.filter( e => e.period_id === 4).length).toFixed(0),
      total:  Number(defensive.length * 100 / teamEvents.length).toFixed(0)

    };

    const dangerousAtt = {
      h1:  Number(dangerous_attacks.filter( e => e.period_id === 2).length * 100 / teamEvents.filter( e => e.period_id === 2).length).toFixed(0),
      h2: Number(dangerous_attacks.filter( e => e.period_id === 4).length * 100 / teamEvents.filter( e => e.period_id === 4).length).toFixed(0),
      total:  Number(dangerous_attacks.length * 100 / teamEvents.length).toFixed(0)

    };
    return {
     dangerous_attacks: dangerousAtt,
     attacks: att,
     defensive: def
  };
}

  getPPDA(events, team) {
    const _FOUL_ID = 4;
    const _INTERCEPTION_ID = 8;
    const _CHALLENGE_ID = 45;
    const _TACKLE_ID = 7;
    const _PASS_ID = 1;
    const _RECOVERY_ID = 49;
    const _CLEARANCE_ID = 12;
    const teamId = team.name.id;

    const allowedOppPasses = events.filter((e) => {
      return e.x <= 60 && e.type_id === _PASS_ID && e.team_id !== teamId;
    });

    const defensiveActions = events.filter((e) => {
      return e.x >= 40 && e.team_id === teamId &&
      (
        e.type_id === _FOUL_ID ||
        e.type_id === _INTERCEPTION_ID ||
        e.type_id === _CHALLENGE_ID ||
        e.type_id === _TACKLE_ID ||
        e.type_id === _CLEARANCE_ID ||
        e.type_id === _RECOVERY_ID
      ) ;
    });

    const h1 = allowedOppPasses.filter( (e) => e.period_id === 2).length / defensiveActions.filter( (e) => e.period_id === 2).length ;
    const h2 = allowedOppPasses.filter( e => e.period_id === 4).length / defensiveActions.filter( e => e.period_id === 4).length;
    const total =  allowedOppPasses.length / defensiveActions.length;
    const ppda = {

        h1: Number(h1).toFixed(2),
        h2: Number(h2).toFixed(2),
      total: Number(total).toFixed(2)
    };

    return ppda;
  }
  getMatchesStats = (m) => {
    return Opta.api.getFootballMatch({
      origin: 'OW',
      source: isNumeric(m.seasonId) ? 'omo' : 'sdapi',
      params: {
        data_type: this.live ? ['events', 'expectedgoals'] : ['events', 'expectedgoals'],
        detailed: true,
        competition_id: m.compId,
        season_id: m.seasonId,
        match_id: m.id,
        oppose_teams: true,
        trn: {
          teams: true,
          comps: true,
          players: true
        },
        live: this.live ? true : false,
        max_age: 30
      },
      done: (d) => {
        //console.log(d);
        //this.getIntesity(d.match, d.match.home);
        const periods =  ['h1', 'h2', 'total'];
        const team = {
          home: d.match.home,
          away: d.match.away
        };

        const matchStats = d.match.getEventStats({
          start: {period: {id: 2}, min: 0, sec: 0},
          end: {period: {id: d.match.period_id}, min: d.match.match_time, sec: 0},
          teams: !0});

        for ( let item in matchStats) {
          if (item === d.match.home.id) {
            Opta.extend(d.match.home.stats, matchStats[item].stats);
          } else {
            Opta.extend(d.match.away.stats, matchStats[item].stats);
          }
        }
        for (const tt of Object.keys(team)) {
          const t = team[tt];
          // tslint:disable-next-line: variable-name
          const confidence_score = {};
          const xg_by_shot = {};
          const opp_goals = {};
          const shots_by_min = {};
          const min_per_shots = {};
          const dangerous_att = this.getActions(d.match, t).dangerous_attacks;
          const attacks = this.getActions(d.match, t).attacks;
          const defensive = this.getActions(d.match, t).defensive;
          const PPDA = this.getPPDA(d.match.events, t);
          const oppSide = tt === 'home' ? team.away : team.home;
          let mt;


          periods.forEach( p => {
            const defensiveActions = t.stats.recoveries[p] +
            t.stats.interceptions[p] +
            t.stats.clearances[p] +
            t.stats.tackles[p] +
            t.stats.fouls_conceded[p] +
            oppSide.stats.shots_blocked[p];
            mt = p === 'h2' ? d.match.match_time - 45 : p === 'h1' && d.match.period_id > 2 ? 45 : d.match.match_time;
            confidence_score[p] = this.calculateConfidence(t, p);
            xg_by_shot[p] = (t.stats.expectedgoals ? t.stats.expectedgoals[p] * 100 : 0) / t.stats.shots[p];
            shots_by_min[p] = (t.stats.shots ? t.stats.shots[p] : 0) / mt;
            min_per_shots[p] = t.stats.shots[p] > 0 ? mt / t.stats.shots[p] : 0;
            /*dangerous_att[p] = (t.stats.passes_final_third[p] * 100 / t.stats.passes[p]).toFixed(0);
            attacks[p] = ( (t.stats.passes_opponents_half[p]
              - t.stats.passes_final_third[p]) * 100 / t.stats.passes[p]).toFixed(0);
            defensive[p] = ((t.stats.passes_success[p] -
              t.stats.passes_opponents_half[p]) * 100
                  / t.stats.passes[p]).toFixed(0);*/

            //PPDA[p] = oppSide.stats.passes_opponents_half[p] / defensiveActions;
          });

          const extended_stats = {
            confidence_score,
            xg_by_shot,
            opp_goals,
            shots_by_min,
            min_per_shots,
            dangerous_att,
            attacks,
            defensive,
            PPDA
          };

          if (t.side === 'home') { Opta.extend(d.match.home.stats, extended_stats); }
          if (t.side === 'away') { Opta.extend(d.match.away.stats, extended_stats); }

        }
        /*if (this.live) {
          Opta.extend(d.match, {})
        }*/
        // !this.live ? Opta.extend(d.match, {goals: this.getGoals(d.match)} ) :
       // console.log(d);
        this.stats = {
          id: d.match.id,
          home: {
            id: null,
            stats: d.match.home.stats,
            score: d.match.home.score,
            logo: null
          },
          away: {
            id: null,
            stats: d.match.away.stats,
            score: d.match.away.score,
            logo: null
          },
          goals: d.match.goals,
          period: d.match.period_id,
          match_time: d.match.match_time,
          clock: d.match.clock,
          period_timestamps: d.match.period_timestamps

        };
        // console.log(this.stats);
        this.emitStats();
      },
      // tslint:disable-next-line:no-shadowed-variable
      fail: (error) => {
        console.log(error);
      }

    });
  }


 getMatchesStats2 = (m: IMatches) => {
  return Opta.api.getFootballMatch({
   origin: 'OW',
   source: isNumeric(m.seasonId) ? 'omo' : 'sdapi',
   params: {
     data_type: this.live ? ['events', 'expectedgoals'] : ['events', 'expectedgoals'],
     detailed: true,
     competition_id: m.compId,
     season_id: m.seasonId,
     match_id: m.id,
     oppose_teams: true,
     trn: {
       teams: true,
       comps: true,
       players: true
     },
     live: this.live ? true : false,
     max_age: 30
   },
   done: (d) => {
     //console.log(d);
     //this.getIntesity(d.match, d.match.home);
     const periods =  ['h1', 'h2', 'total'];
     const team = {
       home: d.match.home,
       away: d.match.away
     };

     const matchStats = d.match.getEventStats({
       start: {period: {id: 2}, min: 0, sec: 0},
       end: {period: {id: d.match.period_id}, min: d.match.match_time, sec: 0},
       teams: !0});

     for ( let item in matchStats) {
       if (item === d.match.home.id) {
         Opta.extend(d.match.home.stats, matchStats[item].stats);
       } else {
         Opta.extend(d.match.away.stats, matchStats[item].stats);
       }
     }
     for (const tt of Object.keys(team)) {
       const t = team[tt];
       // tslint:disable-next-line: variable-name
       const confidence_score = {};
       const xg_by_shot = {};
       const opp_goals = {};
       const shots_by_min = {};
       const min_per_shots = {};
       const dangerous_att = this.getActions(d.match, t).dangerous_attacks;
       const attacks = this.getActions(d.match, t).attacks;
       const defensive = this.getActions(d.match, t).defensive;
       const PPDA = this.getPPDA(d.match.events, t);
       const oppSide = tt === 'home' ? team.away : team.home;
       let mt;


       periods.forEach( p => {
         const defensiveActions = t.stats.recoveries[p] +
         t.stats.interceptions[p] +
         t.stats.clearances[p] +
         t.stats.tackles[p] +
         t.stats.fouls_conceded[p] +
         oppSide.stats.shots_blocked[p];
         mt = p === 'h2' ? d.match.match_time - 45 : p === 'h1' && d.match.period_id > 2 ? 45 : d.match.match_time;
         confidence_score[p] = this.calculateConfidence(t, p);
         xg_by_shot[p] = (t.stats.expectedgoals ? t.stats.expectedgoals[p] * 100 : 0) / t.stats.shots[p];
         shots_by_min[p] = (t.stats.shots ? t.stats.shots[p] : 0) / mt;
         min_per_shots[p] = t.stats.shots[p] > 0 ? mt / t.stats.shots[p] : 0;
         //PPDA[p] = oppSide.stats.passes_opponents_half[p] / defensiveActions;
       });

       const extended_stats = {
         confidence_score,
         xg_by_shot,
         opp_goals,
         shots_by_min,
         min_per_shots,
         dangerous_att,
         attacks,
         defensive,
         PPDA
       };

       if (t.side === 'home') { Opta.extend(d.match.home.stats, extended_stats); }
       if (t.side === 'away') { Opta.extend(d.match.away.stats, extended_stats); }

     }
     /*if (this.live) {
       Opta.extend(d.match, {})
     }*/
     // !this.live ? Opta.extend(d.match, {goals: this.getGoals(d.match)} ) :
    // console.log(d);
     const stats = {
       id: d.match.id,
       home: d.match.home,
       away: d.match.away,
       goals: d.match.goals,
       period: d.match.period_id,
       match_time: d.match.match_time,
       clock: d.match.clock,
       period_timestamps: d.match.period_timestamps,

     };
     stats.home.logo = m.home.logo;
     stats.away.logo = m.away.logo;

     Opta.extend(m, stats);
     this.emitStats();

     // console.log(this.stats);
   },
   // tslint:disable-next-line:no-shadowed-variable
   fail: (error) => {
     console.log(error);
   }

 });


}

  getIntesity = (match: IMatch, team: TeamEntity) => {
    const events = match.events;
    const _PASS_ID = 1;
    const _OUT_ID = 5;
    const _CORNER_AWARDED_ID = 6;
    const _DISPOSSESSED_ID = 50;

    const out = [5, 13, 14, 15, 16, 50];
    let i = 0;

    const sequence = events
    .filter(e => e.team_id = team.id)
    .reduce((acc, now, index, array) => {
      if (!acc[i]) {
        acc[i] = [];
      }
      if (out.some(x => x === now.type_id)) {
        i++ ;
        return acc;
      } else {
        acc[i].push(now.toString()[0]);
      }
      return acc;
    }, {});
    console.log(sequence);
  }

  getGoals = (match: IMatch) => {
    const events = match.events;
    let index = 0;
    const goals = [];
    events.forEach(e => {
      if (e.isGoal()) {
        index++;
        goals.push({
          time_key: e.time_key,
          min: e.min,
          sec: e.sec,
          period_id: e.period_id
        });
      }
    });

    for (let i = goals.length - 1; i >= 0; i--) {
      const endTime = {period: {id: goals[i].period_id}, min: goals[i].min, sec: goals[i].sec};
      const startTime = i > 0 ?
        {period: {id: goals[i - 1].period_id}, min: goals[i - 1].min, sec: goals[i - 1].sec - 1} :
        {period: {id: 2}, min: 0, sec: 0};

      // console.log('start: ', JSON.stringify(startTime), '\nend: ', JSON.stringify(endTime));
      const stats = this.getEventStats(match, startTime, endTime);
      goals[i].stats = stats;
    }

    return goals;

  }

  getStatsSinceLastGoal = (match: IMatch) => {
    const events = match.events;
    let index = 0;
    const goals = [];
    events.forEach(e => {
      if (e.isGoal()) {
        index++;
        goals.push({
          time_key: e.time_key,
          min: e.min,
          sec: e.sec,
          period_id: e.period_id
        });
      }
    });
    const lastGoal = goals[length - 1];

    const startTime = {period: {id: lastGoal.period_id}, min: lastGoal.min, sec: lastGoal.sec + 1};
    const endTime = {period: {id: match.period_id }, min: match.match_time, sec: 0};
      // console.log('start: ', JSON.stringify(startTime), '\nend: ', JSON.stringify(endTime));
    const stats = this.getEventStats(match, startTime, endTime);

    return stats;
  }

calculateConfidence(side, period) {
    const confidence = [
      { stat: 'aerial_duels_lost' , coeficient : -1 , h1: null, h2: null, total: null},
      { stat: 'aerial_duels_won' , coeficient : 1 , h1: null, h2: null, total: null},
      { stat: 'duels_lost' , coeficient : -1 , h1: null, h2: null, total: null},
      { stat: 'duels_won' , coeficient : 1 , h1: null, h2: null, total: null},
      { stat: 'dfl_duels_won' , coeficient : 1 , h1: null, h2: null, total: null},
      { stat: 'dfl_duels_lost' , coeficient : -1 , h1: null, h2: null, total: null},
      { stat: 'ball_recoveries' , coeficient : 1 , h1: null, h2: null, total: null},
      { stat: 'interceptions' , coeficient : 0.25 , h1: null, h2: null, total: null},
      { stat: 'possession_lost_all' , coeficient : -1 , h1: null, h2: null, total: null},
      { stat: 'ball_recoveries_attacking' , coeficient : 2 , h1: null, h2: null, total: null},
      { stat: 'ball_recoveries__midfield' , coeficient : 1.25 , h1: null, h2: null, total: null},
      { stat: 'passes_opponents_half_success' , coeficient : 0.5 , h1: null, h2: null, total: null},
      { stat: 'passes_final_third_success' , coeficient : 1 , h1: null, h2: null, total: null},
      { stat: 'crosses_success' , coeficient : 2 , h1: null, h2: null, total: null},
      { stat: 'crosses_lost' , coeficient : -0.75 , h1: null, h2: null, total: null},
      { stat: 'shots_on_target' , coeficient : 4 , h1: null, h2: null, total: null},
      { stat: 'shots_off_target' , coeficient : -1.5 , h1: null, h2: null, total: null},
      { stat: 'shots_blocked' , coeficient : -1 , h1: null, h2: null, total: null},
      { stat: 'big_chance_created' , coeficient : 3 , h1: null, h2: null, total: null},
      { stat: 'big_chance_missed' , coeficient : -3 , h1: null, h2: null, total: null},
      { stat: 'own_goals' , coeficient : -10, h1: null, h2: null, total: null},
      { stat: 'penalty_missed' , coeficient : -10, h1: null, h2: null, total: null},
      { stat: 'goals' , coeficient : +10 , h1: null, h2: null, total: null},
      { stat: 'goals_conceded' , coeficient : -10 , h1: null, h2: null, total: null},
      { stat: 'cards_red' , coeficient : -10, h1: null, h2: null, total: null}

    ];
    const stats = side.stats;
    confidence.map(m => {
      for (const stat of Object.keys(stats)) {
        const product = stats[stat][period];
        if (stat === m.stat) {
          m[period] = product * m.coeficient;
        }
      }
    });
    const confidenceScore = confidence.
                            map(item => item[period]).
                            reduce((prev, next) => prev + next);
    return confidenceScore;

  }

getEventStats = (match: IMatch, startEvent, endEvent) => {
    // @ts-ignore
    return match.getEventStats({
        start: startEvent,
        end: endEvent,
        teams: !0
      }
    );

  }
getDate = (match) => {
    const date = match.date.toDate();
    return date;
  }
}
