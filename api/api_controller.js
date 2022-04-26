const axios = require("axios");
const { compareSync } = require("bcryptjs");
const { enIE } = require("date-fns/locale");
const { vary, sendfile } = require("express/lib/response");
const { contentDisposition } = require("express/lib/utils");
const rand = require("random-seed").create();
require("dotenv").config();

const userPoints = {};

const CardDeploy = (e) => {
    for (var i = 0; i < 52;) {
        var rNum = rand.intBetween(0, 51);
        if (e.AllCards.Cards.indexOf(rNum) != -1) {
            continue;
        }
        e.AllCards.Cards[i] = rNum;
        if (rNum % 13 > 9) {
            e.AllCards.Weights[i] = 10;
        } else {
            e.AllCards.Weights[i] = rNum % 13 + 2;
        }
        i++;
    }
}

const getDealerCards = async (e) => {
    while (e.Dealer.d_Weight < 17) {
        e.Dealer.Cards[e.Dealer.cardCount] = e.AllCards.Cards[e.AllCards.cardCount];
        e.Dealer.Weights[e.Dealer.cardCount] = e.AllCards.Weights[e.AllCards.cardCount];
        e.Dealer.d_Weight += e.AllCards.Weights[e.AllCards.cardCount];
        e.Dealer.cardCount++;
        e.AllCards.cardCount++;
        if (e.Dealer.d_Weight > 21) {
            if (e.Dealer.Weights.indexOf(11) != -1) {
                e.Dealer.d_Weight -= 10;
                e.Dealer.Weights[e.Dealer.Weights.indexOf(11)] = 1;
            }
        }
    }
    if (e.insurance) {
        if (e.Dealer.Weights[0] + e.Dealer.Weights[1] == 21) {
            e.insuranceMoney = e.in_money;
            await axios.post(
                process.env.PLATFORM_SERVER + "api/games/winlose",
                {
                    token: e.token,
                    amount: e.in_money,
                    winState: e.in_money != 0 ? true : false,
                }
            );
        }
    }
    if (e.splitState) {
        if (e.Dealer.d_Weight > 21) {
            if (e.s_winState == 0) {
                e.s_winState = 3;
            }
            if (e.winState == 0) {
                e.winState = 3;
            }
        } else if (e.Dealer.d_Weight == 21) {
            if (e.winState == 0) {
                e.winState = 1;
            }
            if (e.s_winState == 0) {
                e.s_winState = 1;
            }
        } else if (e.Dealer.d_Weight < 21) {
            if (e.winState == 0) {
                if (e.Dealer.d_Weight > e.Player.p_Weight) {
                    e.winState = 1;
                } else if (e.Dealer.d_Weight == e.Player.p_Weight) {
                    e.winState = 2;
                } else if (e.Dealer.d_Weight < e.Player.p_Weight) {
                    e.winState = 3;
                }
            }
            if (e.s_winState == 0) {
                if (e.Dealer.d_Weight > e.Split.s_Weight) {
                    e.s_winState = 1;
                } else if (e.Dealer.d_Weight == e.Split.s_Weight) {
                    e.s_winState = 2;
                } else if (e.Dealer.d_Weight < e.Split.s_Weight) {
                    e.s_winState = 3;
                }
            }
        }
    } else {
        if (e.Dealer.d_Weight > 21) {
            e.winState = 3;
        } else if (e.Dealer.d_Weight == 21) {
            e.winState = 1;
        } else if (e.Dealer.d_Weight < 21) {
            if (e.Dealer.d_Weight > e.Player.p_Weight) {
                e.winState = 1;
            } else if (e.Dealer.d_Weight == e.Player.p_Weight) {
                e.winState = 2;
            } else if (e.Dealer.d_Weight < e.Player.p_Weight) {
                e.winState = 3;
            }
        }
    }
    await winCheck(e);
    try {
        await sendPlatForm(e);
    } catch {
        throw new Error(1);
    }
}

const getPlayerCards = async (e) => {
    e.Player.Cards[e.Player.cardCount] = e.AllCards.Cards[e.AllCards.cardCount];
    e.Player.Weights[e.Player.cardCount] = e.AllCards.Weights[e.AllCards.cardCount];
    e.Player.p_Weight += e.AllCards.Weights[e.AllCards.cardCount];
    e.Player.cardCount++;
    e.AllCards.cardCount++;
    if (e.Player.p_Weight > 21) {
        e.winState = 1;
        e.Player.State = false;
        if (e.Player.Weights.indexOf(11) != -1) {
            e.Player.p_Weight -= 10;
            e.Player.Weights[e.Player.Weights.indexOf(11)] = 1;
            e.winState = 0;
            e.Player.State = true;
        }
    } else if (e.Player.p_Weight == 21) {
        e.winState = 3;
        e.Player.State = false;
    }
    if (e.insurance) {
        if (e.winState != 0) {
            e.Dealer.Cards[1] = e.AllCards.Cards[e.AllCards.cardCount];
            e.Dealer.Weights[1] = e.AllCards.Weights[e.AllCards.cardCount];
            e.Dealer.cardCount++;
            e.AllCards.cardCount++;
            e.Dealer.d_Weight += e.Dealer.Weights[1];
            if (e.Dealer.d_Weight == 21) {
                e.insuranceMoney = e.in_money;
                console.log("insurance:" + e.insuranceMoney, e.in_money);
                await axios.post(
                    process.env.PLATFORM_SERVER + "api/games/winlose",
                    {
                        token: e.token,
                        amount: e.in_money,
                        winState: e.in_money != 0 ? true : false,
                    }
                );
            }
        }
    }
    await winCheck(e);
    try {
        await sendPlatForm(e);
    } catch {
        throw new Error(1);
    }
}
const getSplitCards = async (e) => {
    e.Split.Cards[e.Split.cardCount] = e.AllCards.Cards[e.AllCards.cardCount];
    e.Split.Weights[e.Split.cardCount] = e.AllCards.Weights[e.AllCards.cardCount];
    e.Split.s_Weight += e.AllCards.Weights[e.AllCards.cardCount];
    e.Split.cardCount++;
    e.AllCards.cardCount++;
    if (e.Split.s_Weight > 21) {
        e.s_winState = 1;
        e.Split.State = false;
        if (e.Split.Weights.indexOf(11) != -1) {
            e.Split.s_Weight -= 10;
            e.Split.Weights[e.Split.Weights.indexOf(11)] = 1;
            e.s_winState = 0;
            e.Split.State = true;
        }
    } else if (e.Split.s_Weight == 21) {
        e.s_winState = 3;
        e.Split.State = false;
    }
    await winCheck(e);
}

const winCheck = (e) => {
    if (e.splitState) {
        if (e.winState != 0 && e.s_winState != 0) {
            gameButtons(e);
        }
        if (e.winState == 2) {
            e.winMoney += e.betAmount;
        } else if (e.winState == 3) {
            e.winMoney += e.betAmount * 2;
        }
        if (e.s_winState == 2) {
            e.winMoney += e.betAmount;
        } else if (e.s_winState == 3) {
            e.winMoney += e.betAmount * 2;
        }
    } else {
        if (e.winState != 0) {
            gameButtons(e);
        }
        if (e.winState == 2) {
            e.winMoney = e.betAmount;
        } else if (e.winState == 3) {
            e.winMoney = e.betAmount * 2;
        }
    }
}

const sendPlatForm = async (e) => {
    console.log("platform:" + e.winMoney);
    await axios.post(
        process.env.PLATFORM_SERVER + "api/games/winlose",
        {
            token: e.token,
            amount: e.winMoney,
            winState: e.winMoney != 0 ? true : false,
        }
    );
}

const gameButtons = (e) => {
    e.buttonStatus.hitButton = false;
    e.buttonStatus.standButton = false;
    e.buttonStatus.splitButton = false;
    e.buttonStatus.doubleButton = false;
    e.buttonStatus.dealButton = true;
    e.buttonStatus.insuranceButton = false;
    e.buttonStatus.oneButton = false;
    e.buttonStatus.twoButton = false;
}

const sendFront = (res, user) => {
    res.json({
        myMessage: 0,
        dealButton: user.buttonStatus.dealButton,
        hitButton: user.buttonStatus.hitButton,
        standButton: user.buttonStatus.standButton,
        splitButton: user.buttonStatus.splitButton,
        doubleButton: user.buttonStatus.doubleButton,
        insuranceButton: user.buttonStatus.insuranceButton,
        playerCards: user.Player.Cards,
        playerCount: user.Player.cardCount,
        playertotalWeight: user.Player.p_Weight,
        dealerCards: user.Dealer.Cards,
        dealerCount: user.Dealer.cardCount,
        dealertotalWeight: user.Dealer.d_Weight,
        splitCards: user.Split.Cards,
        splitCount: user.Split.cardCount,
        splittotalWeight: user.Split.s_Weight,
        winState: user.winState,
        s_winState: user.s_winState,
        winMoney: user.winMoney,
        insuranceMoney: user.insuranceMoney,
        oneImage: user.buttonStatus.oneButton,
        twoImage: user.buttonStatus.twoButton,
    });
}

const betSend = async (e) => {
    console.log("betsend:" + e.betAmount);
    await axios.post(
        process.env.PLATFORM_SERVER + "api/games/bet",
        {
            token: e.token,
            amount: e.betAmount,
        }
    );
}

const defaultButton = (e) => {
    e.buttonStatus.hitButton = true;
    e.buttonStatus.standButton = true;
    e.buttonStatus.splitButton = false;
    e.buttonStatus.doubleButton = false;
    e.buttonStatus.insuranceButton = false;
}

module.exports = {
    StartGame: async (req, res) => {
        console.log(1);
        try {
            const { token, betValue } = req.body;
            userPoints[token] = {
                AllCards: {
                    Cards: [],
                    Weights: [],
                    cardCount: 0
                },
                token: token,
                betAmount: betValue,
                winState: 0,
                Dealer: {
                    Cards: [],
                    Weights: [],
                    cardCount: 0,
                    d_Weight: 0,
                },
                Player: {
                    Cards: [],
                    Weights: [],
                    cardCount: 0,
                    p_Weight: 0,
                    State: true
                },
                Split: {
                    Cards: [],
                    Weights: [],
                    cardCount: 0,
                    s_Weight: 0,
                    State: true
                },
                buttonStatus: {
                    hitButton: true,
                    standButton: true,
                    splitButton: false,
                    doubleButton: true,
                    dealButton: false,
                    insuranceButton: false,
                    oneButton: false,
                    twoButton: false,
                },
                forfietButton: true,
                insurance: false,
                winMoney: 0,
                hit_ClickEvent: true,
                splitState: false,
                s_winState: 0,
                in_money: 0,
                insuranceMoney: 0
            }
            let user = userPoints[token];
            try {
                betSend(user);
            } catch {
                throw new Error(2);
            }
            await CardDeploy(user);
            for (var i = 0; i < 2; i++) {
                user.Player.Cards[i] = user.AllCards.Cards[i];
                user.Player.Weights[i] = user.AllCards.Weights[i];
                user.Player.cardCount++;
                user.Player.p_Weight += user.AllCards.Weights[i];
                user.AllCards.cardCount++;
            }
            if (user.Player.p_Weight == 22) {
                user.Player.Weights[1] = 1;
                user.Player.p_Weight -= 10;
            }
            user.Dealer.Cards[0] = user.AllCards.Cards[user.AllCards.cardCount];
            user.Dealer.Weights[0] = user.AllCards.Weights[user.AllCards.cardCount];
            user.Dealer.cardCount++;
            user.Dealer.d_Weight = user.AllCards.Weights[user.AllCards.cardCount];

            user.AllCards.cardCount++;
            if (user.Dealer.Weights[0] == 11) {
                user.buttonStatus.insuranceButton = true;
            }
            if (user.Player.Weights[0] == user.Player.Weights[1] || (user.Player.Weights[0] * user.Player.Weights[1] == 11)) {
                user.buttonStatus.splitButton = true;
            } else if (user.Player.p_Weight == 21) {
                user.winState = 3;
                user.winMoney = user.betAmount * 2.5;
                await gameButtons(user);
                try {
                    await sendPlatForm(user);
                } catch {
                    throw new Error(1);
                }

            }
            sendFront(res, user);
        } catch (err) {
            res.json({
                myMessage: err.message,
            })
        }
    },
    Hit: async (req, res) => {
        const { token } = req.body;
        let user = userPoints[token];
        if (user.buttonStatus.hitButton) {
            defaultButton(user);
            if (user.splitState) {
                if (!user.Player.State) {
                    user.hit_ClickEvent = false;
                } else if (!user.Split.State) {
                    user.hit_ClickEvent = true;
                }
                if (user.hit_ClickEvent && user.Player.State) {
                    await getPlayerCards(user);
                    user.hit_ClickEvent = false;
                } else if (!user.hit_ClickEvent && user.Split.State) {
                    await getSplitCards(user);
                    user.hit_ClickEvent = true;
                }
                if (!user.Player.State) {
                    user.buttonStatus.oneButton = false;
                    user.buttonStatus.twoButton = true;
                } else if (!user.Split.State) {
                    user.buttonStatus.oneButton = true;
                    user.buttonStatus.twoButton = false;
                }
                if (!user.Player.State && !user.Split.State) {
                    if (user.Player.State != 3 || user.Split.State != 3)
                        await getDealerCards(user);
                }
            } else {
                await getPlayerCards(user);
            }
        }
        sendFront(res, user);
    },
    Stand: async (req, res) => {
        const { token } = req.body;
        let user = userPoints[token];
        if (user.buttonStatus.standButton) {
            defaultButton(user);
            if (user.splitState) {
                if (!user.Player.State) {
                    user.hit_ClickEvent = false;
                } else if (!user.Split.State) {
                    user.hit_ClickEvent = true;
                }
                if (user.hit_ClickEvent && user.Player.State) {
                    user.Player.State = false;
                    user.hit_ClickEvent = false;

                } else if (!user.hit_ClickEvent && user.Split.State) {
                    user.Split.State = false;
                    user.hit_ClickEvent = true;

                }
                if (!user.Player.State && !user.Split.State) {
                    await getDealerCards(user);
                }
            } else {
                await getDealerCards(user);
            }
        }
        sendFront(res, user);
    },
    Double: async (req, res) => {
        const { token } = req.body;
        let user = userPoints[token];
        if (user.buttonStatus.doubleButton) {
            await gameButtons(user);
            await betSend(user);
            user.betAmount = user.betAmount * 2;
            await getPlayerCards(user);
            if (user.winState == 0) {
                await getDealerCards(user);
            }
        }
        sendFront(res, user);
    },
    Split: async (req, res) => {
        const { token } = req.body;
        let user = userPoints[token];
        if (user.buttonStatus.splitButton) {
            defaultButton(user);
            user.splitState = true;
            user.Split.Cards[0] = user.Player.Cards[1];
            user.Split.Weights[0] = user.Player.Weights[1];
            user.Split.s_Weight = user.Player.Weights[1];
            user.Player.p_Weight -= user.Player.Weights[1];
            user.Player.Cards.pop();
            user.Player.Weights.pop();
            user.Split.cardCount++;
            user.Player.cardCount--;
            user.buttonStatus.splitButton = false;
            user.betAmount = user.betAmount / 2;
            user.buttonStatus.oneButton = true;
        }
        sendFront(res, user);
    },
    Insurance: async (req, res) => {
        const { token } = req.body;
        let user = userPoints[token];
        if (user.buttonStatus.insuranceButton) {
            user.in_money = user.betAmount / 2;
            user.insurance = true;
            try {
                await axios.post(
                    process.env.PLATFORM_SERVER + "api/games/bet",
                    {
                        token: user.token,
                        amount: user.in_money,
                    }
                );
            } catch {
                throw new Error(2);
            }
        }
        user.buttonStatus.insuranceButton = false;

        sendFront(res, user);
    },
    Forfiet: async (req, res) => {
        const { token } = req.body;
        let user = userPoints[token];
        if (user.forfietButton) {
            user.winMoney = user.betAmount / 2;
            await sendPlatForm(user);
            user.forfietButton = false;
        }
        sendFront(res, user);
    }
};