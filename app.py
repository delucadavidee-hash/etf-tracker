from flask import Flask, jsonify, render_template, request, session
from flask_cors import CORS
import math, json, os, random

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'etf-tracker-2026')
CORS(app)

MONTHS_IT = ['gen','feb','mar','apr','mag','giu','lug','ago','set','ott','nov','dic']

def gen_portfolio_history():
    data = []
    for i in range(60):
        base = 30000 + i * 280
        noise = math.sin(i/4)*1200 + math.cos(i/7)*800
        bench = 30000 + i*240 + math.sin(i/5)*900
        data.append({'month': f"{MONTHS_IT[i%12]} '{(21+i//12):02d}", 'portfolio': round(base+noise), 'benchmark': round(bench)})
    return data

def gen_backtest():
    return [{'month': f"'{14+int(i/12):02d}", 'myPortfolio': round(10000*(1.084**(i/12))+math.sin(i/3)*600), 'allWeather': round(10000*(1.068**(i/12))+math.sin(i/4)*350), 'benchmark': round(10000*(1.075**(i/12))+math.sin(i/3.5)*800)} for i in range(120)]

def gen_price_history():
    return [{'month': f"{MONTHS_IT[i%12]} '{(22+i//12):02d}", 'price': round(72+i*0.45+math.sin(i/3)*2.8+math.cos(i/5)*1.4, 2)} for i in range(48)]

HOLDINGS = [
    {'isin':'IE00B4L5Y983','ticker':'SWDA','name':'iShares Core MSCI World','qty':180,'price':92.45,'value':16641,'weight':34.8,'pl':2145,'plPct':14.8,'ter':0.20},
    {'isin':'IE00BK5BQT80','ticker':'VWCE','name':'Vanguard FTSE All-World','qty':95,'price':118.22,'value':11231,'weight':23.5,'pl':1687,'plPct':17.7,'ter':0.22},
    {'isin':'IE00BKM4GZ66','ticker':'EIMI','name':'iShares Core MSCI Emerging Markets','qty':310,'price':32.18,'value':9976,'weight':20.8,'pl':856,'plPct':9.4,'ter':0.18},
    {'isin':'IE00B3F81R35','ticker':'AGGH','name':'iShares Core Global Aggregate Bond','qty':95,'price':48.32,'value':4590,'weight':9.6,'pl':-120,'plPct':-2.5,'ter':0.10},
    {'isin':'IE00B579F325','ticker':'SGLD','name':'Invesco Physical Gold','qty':28,'price':195.40,'value':5471,'weight':11.4,'pl':1248,'plPct':29.5,'ter':0.12},
]

ETF_DB = [
    {'isin':'IE00B4L5Y983','ticker':'SWDA','name':'iShares Core MSCI World UCITS ETF','issuer':'iShares','asset':'Azionario','region':'Globale Sviluppati','ter':0.20,'aum':82400,'price':92.45,'chg1d':0.42,'chg1y':14.80,'chg5y':72.30,'replication':'Fisica','distribution':'Accumulazione','domicile':'Irlanda','rating':5},
    {'isin':'IE00BK5BQT80','ticker':'VWCE','name':'Vanguard FTSE All-World UCITS ETF','issuer':'Vanguard','asset':'Azionario','region':'Globale','ter':0.22,'aum':18900,'price':118.22,'chg1d':0.38,'chg1y':17.70,'chg5y':68.40,'replication':'Fisica','distribution':'Accumulazione','domicile':'Irlanda','rating':5},
    {'isin':'IE00BKM4GZ66','ticker':'EIMI','name':'iShares Core MSCI EM IMI UCITS ETF','issuer':'iShares','asset':'Azionario','region':'Emergenti','ter':0.18,'aum':21300,'price':32.18,'chg1d':-0.24,'chg1y':9.40,'chg5y':28.60,'replication':'Fisica','distribution':'Accumulazione','domicile':'Irlanda','rating':4},
    {'isin':'IE00B3F81R35','ticker':'AGGH','name':'iShares Core Global Aggregate Bond UCITS ETF','issuer':'iShares','asset':'Obbligazionario','region':'Globale','ter':0.10,'aum':5800,'price':48.32,'chg1d':0.08,'chg1y':-2.50,'chg5y':-8.20,'replication':'Campionamento','distribution':'Accumulazione','domicile':'Irlanda','rating':4},
    {'isin':'IE00B579F325','ticker':'SGLD','name':'Invesco Physical Gold ETC','issuer':'Invesco','asset':'Commodities','region':'Globale','ter':0.12,'aum':16400,'price':195.40,'chg1d':0.92,'chg1y':29.50,'chg5y':82.10,'replication':'Fisica','distribution':'N/A','domicile':'Irlanda','rating':5},
    {'isin':'IE00B5BMR087','ticker':'CSSPX','name':'iShares Core S&P 500 UCITS ETF','issuer':'iShares','asset':'Azionario','region':'USA','ter':0.07,'aum':97200,'price':548.30,'chg1d':0.55,'chg1y':18.20,'chg5y':94.50,'replication':'Fisica','distribution':'Accumulazione','domicile':'Irlanda','rating':5},
    {'isin':'IE00B53SZB19','ticker':'SXR8','name':'iShares Core S&P 500 UCITS ETF (Dist)','issuer':'iShares','asset':'Azionario','region':'USA','ter':0.07,'aum':8200,'price':72.15,'chg1d':0.54,'chg1y':17.90,'chg5y':91.20,'replication':'Fisica','distribution':'Distribuzione','domicile':'Irlanda','rating':4},
    {'isin':'IE00B4K48X80','ticker':'CEU','name':'iShares Core MSCI Europe UCITS ETF','issuer':'iShares','asset':'Azionario','region':'Europa','ter':0.12,'aum':7100,'price':87.40,'chg1d':0.18,'chg1y':8.30,'chg5y':42.80,'replication':'Fisica','distribution':'Accumulazione','domicile':'Irlanda','rating':4},
    {'isin':'IE00BP3QZ601','ticker':'WSML','name':'iShares MSCI World Small Cap UCITS ETF','issuer':'iShares','asset':'Azionario','region':'Globale Small Cap','ter':0.35,'aum':4300,'price':6.98,'chg1d':0.28,'chg1y':11.40,'chg5y':54.20,'replication':'Campionamento','distribution':'Accumulazione','domicile':'Irlanda','rating':4},
    {'isin':'IE00BYZK4552','ticker':'AUTO','name':'iShares Automation & Robotics UCITS ETF','issuer':'iShares','asset':'Azionario Settoriale','region':'Globale','ter':0.40,'aum':3100,'price':14.82,'chg1d':1.24,'chg1y':22.60,'chg5y':88.40,'replication':'Fisica','distribution':'Accumulazione','domicile':'Irlanda','rating':3},
    {'isin':'LU0290357507','ticker':'DBZB','name':'Xtrackers II Eurozone Government Bond UCITS ETF','issuer':'Xtrackers','asset':'Obbligazionario','region':'Eurozona','ter':0.15,'aum':2800,'price':218.50,'chg1d':0.12,'chg1y':1.80,'chg5y':-4.10,'replication':'Fisica','distribution':'Accumulazione','domicile':'Lussemburgo','rating':4},
    {'isin':'LU0290358497','ticker':'XEON','name':'Xtrackers II EUR Overnight Rate Swap UCITS ETF','issuer':'Xtrackers','asset':'Monetario','region':'Eurozona','ter':0.10,'aum':15200,'price':137.50,'chg1d':0.01,'chg1y':3.80,'chg5y':9.20,'replication':'Sintetica','distribution':'Accumulazione','domicile':'Lussemburgo','rating':4},
    {'isin':'IE00B3XXRP09','ticker':'VUSA','name':'Vanguard S&P 500 UCITS ETF (Dist)','issuer':'Vanguard','asset':'Azionario','region':'USA','ter':0.07,'aum':52400,'price':88.90,'chg1d':0.56,'chg1y':17.80,'chg5y':93.40,'replication':'Fisica','distribution':'Distribuzione','domicile':'Irlanda','rating':5},
    {'isin':'IE00BFMXXD54','ticker':'VUAA','name':'Vanguard S&P 500 UCITS ETF (Acc)','issuer':'Vanguard','asset':'Azionario','region':'USA','ter':0.07,'aum':48100,'price':95.20,'chg1d':0.55,'chg1y':18.10,'chg5y':94.20,'replication':'Fisica','distribution':'Accumulazione','domicile':'Irlanda','rating':5},
    {'isin':'IE00BMW42181','ticker':'EQQQ','name':'Invesco EQQQ NASDAQ-100 UCITS ETF','issuer':'Invesco','asset':'Azionario','region':'USA Tech','ter':0.30,'aum':7800,'price':440.20,'chg1d':0.72,'chg1y':24.80,'chg5y':142.60,'replication':'Fisica','distribution':'Distribuzione','domicile':'Irlanda','rating':5},
    {'isin':'IE00BFZXGZ54','ticker':'EQAC','name':'Invesco EQQQ NASDAQ-100 UCITS ETF Acc','issuer':'Invesco','asset':'Azionario','region':'USA Tech','ter':0.30,'aum':2600,'price':448.80,'chg1d':0.73,'chg1y':25.10,'chg5y':144.20,'replication':'Fisica','distribution':'Accumulazione','domicile':'Irlanda','rating':5},
    {'isin':'IE00BD0NCM55','ticker':'SEMI','name':'VanEck Semiconductor UCITS ETF','issuer':'VanEck','asset':'Azionario Settoriale','region':'Globale','ter':0.35,'aum':3200,'price':42.80,'chg1d':1.62,'chg1y':42.40,'chg5y':182.40,'replication':'Fisica','distribution':'Accumulazione','domicile':'Irlanda','rating':4},
    {'isin':'IE00BGV5VN51','ticker':'SUSW','name':'iShares MSCI World SRI UCITS ETF','issuer':'iShares','asset':'Azionario ESG','region':'Globale Sviluppati','ter':0.20,'aum':7800,'price':13.68,'chg1d':0.36,'chg1y':13.90,'chg5y':65.40,'replication':'Fisica','distribution':'Accumulazione','domicile':'Irlanda','rating':4},
    {'isin':'IE00BKX55T58','ticker':'VHYL','name':'Vanguard FTSE All-World High Dividend Yield UCITS ETF','issuer':'Vanguard','asset':'Azionario Dividendi','region':'Globale','ter':0.29,'aum':4400,'price':62.80,'chg1d':0.22,'chg1y':8.60,'chg5y':42.40,'replication':'Fisica','distribution':'Distribuzione','domicile':'Irlanda','rating':4},
    {'isin':'IE00BJLP1Y77','ticker':'EWRD','name':'SPDR MSCI ACWI IMI UCITS ETF','issuer':'SPDR','asset':'Azionario','region':'Globale','ter':0.17,'aum':3600,'price':215.80,'chg1d':0.39,'chg1y':14.10,'chg5y':65.40,'replication':'Campionamento','distribution':'Accumulazione','domicile':'Irlanda','rating':5},
    {'isin':'IE00BKWQ0G16','ticker':'USPY','name':'SPDR S&P 500 UCITS ETF','issuer':'SPDR','asset':'Azionario','region':'USA','ter':0.03,'aum':13400,'price':62.80,'chg1d':0.56,'chg1y':18.30,'chg5y':94.80,'replication':'Fisica','distribution':'Accumulazione','domicile':'Irlanda','rating':5},
]

MODELS = [
    {'id':'all-weather','name':'All-Weather','author':'Ray Dalio','philosophy':'Bilanciato per performare in ogni scenario economico: crescita, recessione, inflazione, deflazione.','risk':'Medio-Basso','riskLevel':2,'allocation':[{'name':'Azioni Globali','value':30,'color':'#0A2540'},{'name':'Treasury Lungo','value':40,'color':'#1E5AA0'},{'name':'Treasury Medio','value':15,'color':'#5A7A9A'},{'name':'Oro','value':7.5,'color':'#B8860B'},{'name':'Commodities','value':7.5,'color':'#8A5A00'}],'cagr':6.8,'maxDD':-12.4,'sharpe':0.82},
    {'id':'bogleheads','name':'Bogleheads 3-Fund','author':'John Bogle','philosophy':'Semplicità ed efficienza: tre ETF, massima diversificazione, costi minimi.','risk':'Medio','riskLevel':3,'allocation':[{'name':'MSCI World','value':60,'color':'#0A2540'},{'name':'Emerging Markets','value':20,'color':'#1E5AA0'},{'name':'Aggregate Bond','value':20,'color':'#5A7A9A'}],'cagr':8.1,'maxDD':-22.8,'sharpe':0.71},
    {'id':'permanent','name':'Permanent Portfolio','author':'Harry Browne','philosophy':'Quattro asset non correlati in parti uguali. Minimalista, robusto, anti-crisi.','risk':'Basso','riskLevel':1,'allocation':[{'name':'Azioni','value':25,'color':'#0A2540'},{'name':'Oro','value':25,'color':'#B8860B'},{'name':'Bond Lungo','value':25,'color':'#1E5AA0'},{'name':'Cash/Bond Breve','value':25,'color':'#5A7A9A'}],'cagr':5.9,'maxDD':-8.2,'sharpe':0.74},
    {'id':'growth','name':'Growth 90/10','author':'Long-term aggressive','philosophy':'Per orizzonti lunghi (20+ anni): massimizza crescita accettando alta volatilità.','risk':'Alto','riskLevel':4,'allocation':[{'name':'MSCI World','value':70,'color':'#0A2540'},{'name':'Emerging Markets','value':20,'color':'#1E5AA0'},{'name':'Aggregate Bond','value':10,'color':'#5A7A9A'}],'cagr':9.4,'maxDD':-31.5,'sharpe':0.68},
    {'id':'golden-butterfly','name':'Golden Butterfly','author':'Tyler (Portfolio Charts)','philosophy':'Bilancia crescita azionaria con oro e treasuries, privilegia small cap value.','risk':'Medio-Basso','riskLevel':2,'allocation':[{'name':'US Total Stock','value':20,'color':'#0A2540'},{'name':'US Small Value','value':20,'color':'#1E5AA0'},{'name':'Treasury Lungo','value':20,'color':'#5A7A9A'},{'name':'Treasury Breve','value':20,'color':'#6BA3E8'},{'name':'Oro','value':20,'color':'#B8860B'}],'cagr':7.2,'maxDD':-13.8,'sharpe':0.85},
    {'id':'swensen','name':'Yale Endowment (Swensen)','author':'David Swensen','philosophy':'Ispirato al fondo di Yale: massima diversificazione con REITs e Treasuries protetti da inflazione.','risk':'Medio','riskLevel':3,'allocation':[{'name':'US Stock Market','value':30,'color':'#0A2540'},{'name':'Internazionali Sviluppati','value':15,'color':'#1E5AA0'},{'name':'Emerging Markets','value':10,'color':'#6BA3E8'},{'name':'REITs','value':15,'color':'#B8860B'},{'name':'Treasury Lungo','value':15,'color':'#5A7A9A'},{'name':'TIPS','value':15,'color':'#8A5A00'}],'cagr':7.8,'maxDD':-27.4,'sharpe':0.72},
]

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/portfolio/summary')
def portfolio_summary():
    return jsonify({'name':'Portafoglio Principale','totalValue':47832.45,'invested':41200.00,'pl':6632.45,'plPercent':16.10,'dayChange':284.33,'dayChangePercent':0.60})

@app.route('/api/portfolio/history')
def portfolio_history():
    return jsonify(gen_portfolio_history())

@app.route('/api/portfolio/holdings')
def portfolio_holdings():
    return jsonify(HOLDINGS)

@app.route('/api/portfolio/allocation/asset')
def allocation_asset():
    return jsonify([{'name':'Azionario Sviluppati','value':58.3,'color':'#0A2540'},{'name':'Azionario Emergenti','value':20.8,'color':'#1E5AA0'},{'name':'Oro','value':11.4,'color':'#B8860B'},{'name':'Obbligazionario','value':9.6,'color':'#5A7A9A'}])

@app.route('/api/portfolio/allocation/geo')
def allocation_geo():
    return jsonify([{'name':'Nord America','value':48.2},{'name':'Europa','value':18.5},{'name':'Asia Pacifico','value':12.3},{'name':'Mercati Emergenti','value':15.4},{'name':'Altro','value':5.6}])

@app.route('/api/portfolio/correlation')
def correlation():
    return jsonify([{'etf':'SWDA','SWDA':1.00,'VWCE':0.98,'EIMI':0.72,'AGGH':0.15,'SGLD':0.08},{'etf':'VWCE','SWDA':0.98,'VWCE':1.00,'EIMI':0.78,'AGGH':0.18,'SGLD':0.10},{'etf':'EIMI','SWDA':0.72,'VWCE':0.78,'EIMI':1.00,'AGGH':0.22,'SGLD':0.14},{'etf':'AGGH','SWDA':0.15,'VWCE':0.18,'EIMI':0.22,'AGGH':1.00,'SGLD':0.31},{'etf':'SGLD','SWDA':0.08,'VWCE':0.10,'EIMI':0.14,'AGGH':0.31,'SGLD':1.00}])

@app.route('/api/etfs')
def etfs():
    q = request.args.get('q','').lower()
    asset = request.args.get('asset','')
    result = ETF_DB
    if q:
        result = [e for e in result if q in e['ticker'].lower() or q in e['name'].lower()]
    if asset:
        result = [e for e in result if e['asset'] == asset]
    return jsonify(result)

@app.route('/api/etfs/<ticker>')
def etf_detail(ticker):
    etf = next((e for e in ETF_DB if e['ticker'].upper() == ticker.upper()), None)
    if not etf:
        return jsonify({'error':'non trovato'}), 404
    r = dict(etf)
    r['priceHistory'] = gen_price_history()
    return jsonify(r)

@app.route('/api/models')
def model_portfolios():
    return jsonify(MODELS)

@app.route('/api/backtest')
def backtest():
    return jsonify(gen_backtest())

@app.route('/api/alerts')
def alerts():
    return jsonify([{'id':1,'etf':'VWCE','message':'Scende sotto €115 — occasione pre-PAC','time':'2h fa','active':True,'type':'down'},{'id':2,'etf':'EIMI','message':'Sopra target del 3.2% — valuta ribilanciamento','time':'1g fa','active':True,'type':'up'},{'id':3,'etf':'SGLD','message':'Stacco dividendo previsto 28 aprile','time':'3g fa','active':False,'type':'calendar'}])

@app.route('/api/community')
def community():
    return jsonify([{'id':1,'user':'Marco R.','avatar':'MR','time':'3h fa','content':'Dopo 4 anni di PAC mensile su VWCE, finalmente ho raggiunto i 50k investiti. Lezione più grande: non guardare il portafoglio tutti i giorni.','likes':127,'comments':34},{'id':2,'user':'Sara E.','avatar':'SE','time':'1g fa','content':'Chiedo consiglio: ha senso aggiungere un ETF sui mercati di frontiera al mio portafoglio All-World + EM?','likes':45,'comments':28},{'id':3,'user':'Luca F.','avatar':'LF','time':'2g fa','content':'Condivido il mio portafoglio FIRE: SWDA 70%, EIMI 15%, AGGH 10%, SGLD 5%. Obiettivo FIRE entro il 2035.','likes':203,'comments':67}])

@app.route('/api/academy')
def academy():
    return jsonify([{'level':'Base','title':"Cos'è un ETF e perché investirci",'lessons':8,'duration':'45 min'},{'level':'Base','title':'Scegliere il tuo primo ETF','lessons':6,'duration':'30 min'},{'level':'Intermedio','title':'Asset allocation per obiettivi','lessons':12,'duration':'1h 20min'},{'level':'Intermedio','title':'PAC vs PIC: strategie a confronto','lessons':9,'duration':'55 min'},{'level':'Avanzato','title':'Ribilanciamento e finestre ottimali','lessons':10,'duration':'1h 15min'},{'level':'Avanzato','title':'Factor investing con ETF','lessons':14,'duration':'2h 10min'}])

@app.route('/api/simulation/montecarlo', methods=['POST'])
def montecarlo():
    data = request.get_json() or {}
    capital = float(data.get('capital', 10000))
    monthly = float(data.get('monthly', 500))
    years = int(data.get('years', 20))
    cagr = float(data.get('cagr', 8)) / 100
    vol = float(data.get('vol', 14)) / 100
    sims = []
    for _ in range(300):
        val, path = capital, [round(capital)]
        for m in range(years * 12):
            r = (1+cagr)**(1/12)-1 + random.gauss(0, vol/math.sqrt(12))
            val = val*(1+r)+monthly
            path.append(round(val))
        sims.append(path)
    steps = years*12+1
    p10,p50,p90 = [],[],[]
    for s in range(steps):
        vals = sorted([x[s] for x in sims])
        n = len(vals)
        p10.append(vals[int(n*0.10)]); p50.append(vals[int(n*0.50)]); p90.append(vals[int(n*0.90)])
    return jsonify({'p10':p10,'p50':p50,'p90':p90,'years':years})

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    email = data.get('email','')
    if email:
        user = {'name': email.split('@')[0].title(), 'email': email}
        session['user'] = user
        return jsonify({'success':True,'user':user})
    return jsonify({'success':False}), 400

@app.route('/api/auth/logout', methods=['POST'])
def logout():
    session.pop('user',None)
    return jsonify({'success':True})

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
