import {Component, NgZone, OnInit, OnDestroy, HostListener, Input} from '@angular/core';
import {IMatches} from '../../models/matches.model';
import {Subscription, timer} from 'rxjs';
import {MatchService} from '../../services/opta-api/football/match.service';
import {CompetitionService} from '../../services/opta-api/football/competition.service';
import {IStats} from '../../models/stats.model';
import * as moment from 'moment';
import { isNumeric } from 'rxjs/util/isNumeric';

declare var Opta: any;


@Component({
  selector: 'app-matches',
  templateUrl: './matches.component.html',
  styleUrls: ['./matches.component.scss']
})
export class MatchesComponent implements OnInit, OnDestroy {

  @Input() matches: IMatches[];
  matchesSubscription: Subscription;
  statsSubscription: Subscription;
  stats: IStats[];

  ticks = 0;
  timeSubscription: Subscription;
  secondLeft = 0;
  minuteLeft = 0;
  interval;
  subscribeSeconds: any;
  subscribeMinute: any;
  live: boolean;
  finished: boolean;
  preMatch: boolean;
  newMatches: any;
  periods = [
    { name: 'h1', period: 2},
    {name: 'h2', period: 4},
    { name: 'total', period: 10}
    ];

  side = ['home', 'away'];


  stat = [
    ['duels', 'duels_accuracy'],
    ['crosses', 'crosses_accuracy', 40],
    ['ball_recoveries'],
    ['expectedassists'],
    ['expectedgoals', 'expectedgoals_nonpenalty'],
    ['shots', 'shots_accuracy', 50, true],
    ['shots_blocked'],
    ['xg_by_shot'],
    ['min_per_shots'],
    ['ball_recoveries_attacking', 3],
    ['ball_recoveries_midfield'],
    ['ball_recoveries_defensive'],
    ['passes_final_third_successful'],
    ['passes_forward'],
    ['dangerous_att', 25],
    ['attacks', 45],
    ['defensive', 65],
    ['PPDA'],
    ['confidence_score']
  ];

  config = {
    itemsPerPage: 18,
    currentPage: 1,
    totalItems: 18 * 2
  };

  TRANS = null;
  isChanged = false;

  constructor(private competitionService: CompetitionService,
              private matchService: MatchService,
              private ngZone: NgZone) {
  }


  ngOnInit() {
    this.matchService.loadTranslations();
    this.TRANS = this.matchService.TRANS;

//    this.newMatches = this.formatedMatches(this.matches);

    this.matchesSubscription = this.competitionService.matchesSubject.subscribe(
      (matches: IMatches[]) => {
        this.ngZone.run(() => {
          this.newMatches = this.formatedMatches(matches);
        });
      }
    );


    this.statsSubscription = this.matchService.statsSubject.subscribe(
      (stats: IStats[]) => {
        this.ngZone.run(() => {
          this.stats = stats;
        });
      }
    );



    this.competitionService.emitMatches();



    this.live = this.competitionService.live;
    this.preMatch = this.competitionService.preMatch;


  }

 getMatchesStats = (m: IMatches) => {
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
          const dangerous_att = this.competitionService.getActions(d.match, t).dangerous_attacks;
          const attacks = this.competitionService.getActions(d.match, t).attacks;
          const defensive = this.competitionService.getActions(d.match, t).defensive;
          const PPDA = this.competitionService.getPPDA(d.match.events, t);
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
            confidence_score[p] = this.competitionService.calculateConfidence(t, p);
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

        Opta.extend(this.matches.filter((match) => match.id === d.match.id), stats);

        // console.log(this.stats);
      },
      // tslint:disable-next-line:no-shadowed-variable
      fail: (error) => {
        console.log(error);
      }

    });


  }
  onGetMatchEvent(match: IMatches) {
    const dataType = ['stats'];
    this.matchService.getMatchData(match.id, match.compId, match.seasonId, dataType).then();
    this.matchService.emitMatch();
  }

  // onGetExpectedGoals(matches: IMatches[]) {
  //   const dataType = ['expectedgoals'];
  //   matches.forEach( (m) => {
  //     this.matchService.getMatchData(m.id, m.compId, m.seasonId, dataType).then( (stats: StatsModel[]) => {
  //       this.stats = stats;
  //     });
  //   });
  //
  //   this.competitionService.emitMatches();
  //   console.log(this.matches);
  // }

  onDisplayMatch(matches: IMatches) {
    console.log(matches);
  }

  @HostListener('window:beforeunload')
  ngOnDestroy() {
   if(this.statsSubscription) {this.statsSubscription.unsubscribe()}
   if(this.matchesSubscription) {this.matchesSubscription.unsubscribe()}
  }

  onGetStats(index: number) {
    return this.stats[index];
  }

  modelChanged() {
    console.log('model changed');

    this.isChanged = true;
    setTimeout(() => {
      this.isChanged = false;
    }, 1000);
  }

  getMatchStatus(m) {
    if (m.status === 'prematch') {
      const d = '2-digit';
      const date = m.Date.toLocaleDateString('fr-FR', {month: d, year: d, day: d, hour: d, minute: d, hour12: false});
      return moment(m.Date.getTime()).format('DD/MM HH:mm');
    } else if (m.status === 'finished') {
      return 'FT';
    } else if (m.period === 3) {
      // this.pauseTimer();
      return 'HT';
    } else {
      return m.match_time + '\'';
      // this.getMatchTimer(m);
      // this.oberserableTimer();
      // return this.subscribeSeconds + ':' + this.subscribeSeconds;
    }
  }

  getMatchTimer(m) {
    const period = m.period;
    if (period === 2) {
      this.minuteLeft = new Date(new Date().getTime() - m.period_timestamps.first_half_start).getMinutes();
      this.secondLeft = new Date(new Date().getTime() - m.period_timestamps.first_half_start).getSeconds();
      this.startTimer();
    } else if (period === 4) {
      this.minuteLeft = 45 + new Date(new Date().getTime() - m.period_timestamps.second_half_start).getMinutes();
      this.secondLeft = new Date(new Date().getTime() - m.period_timestamps.second_half_start).getSeconds();
      this.startTimer();
    }
  }


  getMatchStatusClass(m) {
    if (m.status === 'prematch') {
      return 'small';
    } else {
      return 'mark strong';
    }
  }

  getOnFireColor(m, item, side, total) {
    const val = item[item.length - 1];
    if (isNumeric(val)) {
      const it = item[item.length - 2];
      const itemValue = m[side].stats[it];
      if (itemValue[total] && itemValue[total] >= val) {
        return 'table-danger';
      }
    }


  }

  getItem2(m, item, side, total) {
    const it = m[side].stats[item[1]];
    if (it) {
      const val =  !isNaN(it[total]) ? Math.round(it[total] * 100) / 100 : 0;
      return item[1].includes('accuracy') ? '(' + val + '%)' : '(' + val + ')';
    }
  }

  getItem1(m, item, side, total) {
    const it = m[side].stats[item[0]];
    return it && !isNaN(it[total]) ? Math.round(it[total] * 100) / 100 : 0;
  }


  getWinnerColor(match, side) {
    const draw = match.home.score.total === match.away.score.total;
    const homeWin = match.home.score.total > match.away.score.total && side === 'home';
    const awayWin = match.home.score.total < match.away.score.total && side === 'away';

    if (draw && side === 'draw') {
      return 'table-warning';
    } else if (homeWin || awayWin) {
      return 'table-success';
    }
  }

  pageChanged(event: any) {
    this.config.currentPage = event;
  }

  oberserableTimer() {
    const source1 = timer(1000, 1000);
  }

  startTimer() {
    this.interval = setInterval(() => {
      if (this.secondLeft < 59 ) {
        this.secondLeft++;

      } else {
        this.secondLeft = 0;
        this.minuteLeft++;
      }
    }, 1000);
  }

  pauseTimer() {
    clearInterval(this.interval);
    this.secondLeft = 0;
    this.minuteLeft = 45;
  }

  objectKey(obj) {
    return this.competitionService.preMatch ? Object.keys(obj) : Object.keys(obj).reverse();
  }

  getMatchDayPeriod(matches) {
    const min = matches.map(item => new Date(item.Date.getTime())).reduce((a , b) => a < b ? a : b);
    const max = matches.map(item => new Date(item.Date.getTime())).reduce((a , b) => a > b ? a : b);
    const minDay = min.getUTCDate();
    const maxDay = max.getUTCDate();
    const minMonth = min.toLocaleString('default', { month: 'long' });
    const maxMonth = max.toLocaleString('default', { month: 'long' });
    return minDay === maxDay ?
            minDay + ' ' + minMonth :
            minMonth === maxMonth ?
              minDay + '-' + maxDay + ' ' + minMonth :
              minDay + ' ' + minMonth + '-' + maxDay + ' ' + maxMonth;
  }

  formatedMatches(matches: IMatches[]) {
    const res = matches.reduce((prev, now) => {
      if (!prev[now.matchday]) {
            prev[now.matchday] = [];
      }
      prev[now.matchday].push(now);
      return prev;
    }, {});

    console.log(res);
    return res;
  }

  newArray(val) {
    return Array.from(Array(val));
  }

  getExpectedGoals = (e) => {
    if (e.hasQ(321)) {
      return Opta.NumberFormatter.format(
        e.qualifiers[321].value,
        { style: 'decimal', maximumFractionDigits: 4 }
      );
    } else if (e.isOwnGoal()) {
      return -1;
    }
    return 0;
  }
}
