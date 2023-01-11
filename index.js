//进行包的请求
const path = require("path");
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const {
  init: initDB,
  user_flavor,
  user_favorite,
  foodlist,
  order,
  food_user_degree,
  store,
  diningroom,
  store_user,
} = require("./db");
const { Association, Sequelize } = require("sequelize");
const sd = require("silly-datetime");
const ejs = require("ejs");
const cookieParser = require("cookie-parser");

const logger = morgan("tiny");

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cors({ credentials: true, origin: true }));
app.use(logger);
app.set("view engine", "ejs");
app.set("views", "./");
app.use(cookieParser());

//设置静态文件路径
app.use(express.static(__dirname + "/"));

// 首页
app.get("/", async (req, res) => {
  res.redirect("/store_login.html");
});

//商家注册页面
app.get("/store_register", async (req, res) => {
  res.sendFile(path.join(__dirname, "/store_register.html"));
});

//商家登录页面
app.get("/store/login", async (req, res) => {
  res.redirect("/store_login.html");
});

//获取商家注册信息
app.post("/store_register_post", async (req, res) => {
  //判断用户输入的注册信息是否有误
  if (
    !req.body.email ||
    !req.body.pswd ||
    !req.body.pswd2 ||
    !req.body.address_dining ||
    !req.body.Storename
  ) {
    //渲染错误信息
    res.render("store_register_err.ejs", {
      erromessage: "有注册信息为空！",
    });
    //结束运行
    return;
  }
  //检测用户输入的两次密码是否一致
  if (req.body.pswd != req.body.pswd2) {
    //渲染错误信息
    res.render("store_register_err.ejs", {
      dirname: __dirname,
      erromessage: "输入密码不一致！",
    });
    //结束运行
    return;
  }
  //将餐厅地址拼接
  var address = req.body.address_dining + req.body.address_level;
  //根据用户输入的账号查询数据库
  const findstoreuser = await store_user.findOne({
    where: {
      store_account: req.body.email,
    },
  });
  //根据用户输入的餐厅查询数据库
  const finddining = await diningroom.findOne({
    where: {
      dining_name: req.body.address_dining,
    },
  });
  //如果用户输入的餐厅不存在，则报错
  if (finddining == null) {
    //渲染错误信息
    res.render("store_register_err.ejs", {
      erromessage: "输入餐厅不存在！",
    });
    return;
  }
  //如果用户输入的账号已存在，则报错；否则进行注册
  if (findstoreuser == null) {
    //创建用户数据
    await store_user.create({
      store_name: req.body.Storename,
      store_account: req.body.email,
      store_password: req.body.pswd,
    });
    //创建商铺数据
    await store.create({
      store_name: req.body.Storename,
      diningroom_id: finddining.dataValues.id,
      dining_name: finddining.dataValues.dining_name,
    });
    //渲染信息
    res.render("store_register_ok.ejs", {
      erromessage: "注册成功！",
    });
    return;
  } else {
    //渲染错误信息
    res.render("store_register_err.ejs", {
      erromessage: "注册账号已存在！",
    });
    return;
  }
});

//获取商家登录信息
app.post("/store_login_post", async (req, res) => {
  //根据用户输入的账号查询数据库
  const findstoreuser = await store_user.findOne({
    where: {
      store_account: req.body.email,
    },
  });
  //如果查询不到结果
  if (findstoreuser == null) {
    //报错页面
    res.render("store_register_ok.ejs", {
      erromessage: "该账号未注册！",
    });

    return;
  }
  //如果输入密码与数据库不符
  if (findstoreuser.dataValues.store_password != req.body.pswd) {
    //报错页面
    res.render("store_register_ok.ejs", {
      erromessage: "输入密码错误！",
    });
    return;
  }
  //记录用户id为cookie
  res.cookie("user_store_id", findstoreuser.dataValues.id, {
    domain: ".express-snor-19436-6-1315192441.sh.run.tcloudbase.com",
  });
  //渲染用户页面
  res.redirect("/store_user_index");
});

//重定向至用户界面
app.get("/store_user_index", async (req, res) => {
  //用户查询cookie所属的商铺账号数据
  const findstoreuser = await store_user.findOne({
    where: {
      id: req.cookies.user_store_id,
    },
  });
  //用户查询cookie所属的商铺的食物清单
  const store_foodlist = await foodlist.findAll({
    where: {
      store_id: req.cookies.user_store_id,
    },
  });
  //根据食物清单的长度，设置背景
  if (store_foodlist.length < 13) {
    var back_height = 90;
  } else {
    var back_height = 90 + (store_foodlist.length - 13) * 4;
  }
  //渲染管理面板
  res.render("store_main.ejs", {
    store_name: findstoreuser.dataValues.store_name,
    data: store_foodlist,
    height: back_height + "%",
  });
});

//响应添加食物列表的请求
app.post("/food_update", async (req, res) => {
  //一个用于储存食物取向的矩阵
  var food = [];
  //将食物取向存入矩阵
  food.push(req.body.option1);
  food.push(req.body.option2);
  food.push(req.body.option3);
  food.push(req.body.option4);
  food.push(req.body.option5);
  //将矩阵转化为字符串，并跳过空组
  var foodser = "";
  for (var i = 0; i < 5; i++) {
    if (food[i] != null) {
      foodser = foodser + food[i] + ",";
    } else {
      continue;
    }
  }
  //将价格拼凑完整
  if (req.body.price_2 == "") {
    var price = req.body.price_1 + "." + 0;
  } else {
    var price = req.body.price_1 + "." + req.body.price_2;
  }
  //按照数据，创建食物记录
  await foodlist.create({
    food_name: req.body.foodname,
    food_series: req.body.foodseries,
    food_dgof_salt: foodser,
    food_type: req.body.foodtype,
    food_price: price,
    food_degree: 80,
    store_id: req.cookies.user_store_id,
  });
  //重定向至管理面板
  res.redirect("/store_user_index");
});

//响应更改食物详情的请求
app.post("/food_change", async (req, res) => {
  //一个用于储存食物取向的矩阵
  var food = [];
  //将食物取向存入矩阵
  food.push(req.body.change_option1);
  food.push(req.body.change_option2);
  food.push(req.body.change_option3);
  food.push(req.body.change_option4);
  food.push(req.body.change_option5);
  //将矩阵转化为字符串，并跳过空组
  var foodser = "";
  for (var i = 0; i < 5; i++) {
    if (food[i] != null) {
      foodser = foodser + food[i] + ",";
    } else {
      continue;
    }
  }
  //将价格拼凑完整
  if (req.body.price_2 == "") {
    var price = req.body.change_price_1 + "." + 0;
  } else {
    var price = req.body.change_price_1 + "." + req.body.change_price_2;
  }
  //按照数据，修改食物记录
  await foodlist.update(
    {
      food_name: req.body.change_foodname,
      food_series: req.body.change_foodseries,
      food_dgof_salt: foodser,
      food_type: req.body.change_foodtype,
      food_price: price,
    },
    {
      where: {
        id: req.body.change_foodid,
        store_id: req.cookies.user_store_id,
      },
    }
  );
  //重定向至管理面板
  res.redirect("/store_user_index");
});

//响应删除食物的请求
app.post("/food_delete", async (req, res) => {
  //按照输入的id，删除食物记录
  await foodlist.destroy({
    where: {
      id: req.body.delete_foodid,
      store_id: req.cookies.user_store_id,
    },
  });
  //重定向至管理面板
  res.redirect("/store_user_index");
});

//响应退出操作的请求
app.post("/quit", async (req, res) => {
  //清理cookie
  res.clearCookie("user_store_id");
  //重定向至首页
  res.redirect("/");
});

// 小程序调用，获取微信 Open ID
app.get("/api/wx_openid", async (req, res) => {
  if (req.headers["x-wx-source"]) {
    res.send(req.headers["x-wx-openid"]);
  }
});

// 根据OpenID比对数据库判断是否注册
app.post("/api/user_login", async (req, res) => {
  const finduser = await user_flavor.findAll({
    where: {
      user_id: req.headers["x-wx-openid"],
    },
  });
  console.log(finduser);
  if (finduser != "") {
    res.redirect("/");
  } else {
    res.send("/api/register");
  }
});

// 跳转注册
app.post("/api/register", async (req, res) => {
  userid = req.headers["x-wx-openid"];
  console.log(userid);
  //如果没有检测到openID,即用户没有登录微信
  if (userid == null) {
    res.redirect("/login");
  } else {
    //检测到OpenID后
    //根据上传参数进行用户创建
    await user_flavor.create({
      user_id: userid,
      user_name: req.query.user_name,
      user_dgof_salt: req.query.user_dgof_salt,
      user_series: req.query.user_series,
      user_bedroom: req.query.user_bedroom,
    });
    res.send("注册成功");
  }
});

// 根据微信OpenID返回个人信息数据
app.get("/api/get_userinfo", async (req, res) => {
  userid = req.headers["x-wx-openid"];
  const userinfo = await user_flavor.findAll({
    where: {
      user_id: userid,
    },
  });
  console.log(userinfo);
  res.send(userinfo);
});

// 根据微信OpenID返回用户个人收藏的食物
app.get("/api/myfavorite", async (req, res) => {
  //读取openid
  userid = req.headers["x-wx-openid"];
  //定义一个数组用于存放食物id
  var foodidlist = [];
  //定义一个数组用于存放餐厅id
  var storelist = [];
  //根据用户id查询喜爱的食物的id
  const favorite_food_id = await user_favorite.findAll({
    attributes: ["food_id"],
    where: {
      user_id: userid,
    },
  });
  //根据查询结果，填充食物id数组
  for (var i = 0; i < favorite_food_id.length; i++) {
    foodidlist.push(favorite_food_id[i].dataValues.food_id);
  }
  //根据食物id数组，查询食物名称结果
  const favorite_food = await foodlist.findAll({
    attributes: ["id", "food_name", "food_degree", "food_price"],
    where: {
      id: foodidlist,
    },
  });
  //根据食物id数组，查询商铺id
  const storeid = await foodlist.findAll({
    attributes: ["store_id"],
    where: {
      food_id: foodidlist,
    },
  });
  //根据查询结果，填充商铺id数组
  for (var i = 0; i < storeid.length; i++) {
    storelist.push(storeid[i].dataValues.store_id);
  }
  //根据食物id数组，查询对应食物所在的商铺
  const favorite_food_store = await store.findAll({
    attributes: ["store_name", "diningroom_id", "dining_name"],
    where: {
      id: storelist,
    },
  });
  //返回食物id
  console.log(foodidlist);
  var favorite_food_alldata = [];
  favorite_food_alldata.push(favorite_food);
  favorite_food_alldata.push(favorite_food_store);
  res.send(favorite_food_alldata);
});

// 根据微信openid，采纳盲盒添加个人订单
app.post("/api/rand_orders", async (req, res) => {
  //读取用户id
  var userid = req.headers["x-wx-openid"];
  //根据用户id，生成订单号
  var orderid = userid + Math.floor(Math.random() * 999999999);
  var date = sd.format(new Date(), "YYYY-MM-DD");
  //在同一订单号下，循环写入数据至数据库
  for (
    var i = 0;
    req.query.foodid[i] != "" && req.query.foodid[i] != null;
    i++
  ) {
    var foodname = await foodlist.findAll({
      attributes: ["food_name"],
      where: {
        id: req.query.foodid[i],
      },
    });
    await order.create({
      user_id: userid,
      order_onlyid: orderid,
      food_id: req.query.foodid[i],
      food_name: foodname[0].dataValues.food_name,
      order_date: date,
    });
  }
  //重定向至下单完成路由
  res.redirect("/order_ok");
});

// 根据微信openid，添加个人订单
app.post("/api/orders", async (req, res) => {
  //读取用户id
  var userid = req.headers["x-wx-openid"];
  //根据用户id，生成订单号
  var orderid = userid + Math.floor(Math.random() * 999999999);
  var date = sd.format(new Date(), "YYYY-MM-DD");
  //根据选择的推荐早餐，写入数据
  var orderfoodname = await foodlist.findAll({
    attributes: ["food_name"],
    where: {
      id: req.query.foodid,
    },
  });
  await order.create({
    user_id: userid,
    order_onlyid: orderid,
    food_id: req.query.foodid,
    food_name: orderfoodname[0].dataValues.food_name,
    order_date: date,
  });
  //重定向至下单完成路由
  res.redirect("/order_ok");
});

//按照日期读取个人订单的方法
app.get("/api/orderhistory", async (req, res) => {
  //读取用户id
  var userid = req.headers["x-wx-openid"];
  //根据用户id，读取过去五个下了订单的日期
  var order_date = await order.findAll({
    attributes: ["order_date"],
    order: [["order_date", "desc"]],
    group: ["order_date"],
    limit: 5,
    where: {
      user_id: userid,
    },
  });
  //根据有订单的日期，回溯每一个日期的选择
  var order_fivedays = [];
  for (var i = 0; order_date[i] != null; i++) {
    var orderdate = await order.findAll({
      attributes: ["order_date", "food_name", "food_id"],
      where: {
        order_date: order_date[i].dataValues.order_date,
      },
    });
    order_fivedays.push(orderdate);
  }
  res.send(order_fivedays[0][2].food_name);
});

//用户对订单打分
app.post("/api/setdegree", async (req, res) => {
  //读取用户id
  var userid = req.headers["x-wx-openid"];
  //读取用户打分的食物
  var food_degree_id = req.query.foodid;
  //读取用户对食物的打分
  var food_degree_of_user = req.query.fooddegree;
  //判断用户是否已经对该食物打过分
  var food_degree_history = await food_user_degree.findOne({
    attributes: ["user_degree"],
    where: {
      user_id: userid,
      food_id: food_degree_id,
    },
  });
  //如果用户从来没打过分
  if (food_degree_history == null) {
    //上传用户对食物打分的记录
    await food_user_degree.create({
      user_id: userid,
      food_id: food_degree_id,
      user_degree: food_degree_of_user,
    });
    res.send("评分完成");
    //如果用户有过打分记录
  } else {
    //更新用户的评分
    await food_user_degree.update(
      { user_degree: food_degree_of_user },
      {
        where: {
          user_id: userid,
          food_id: food_degree_id,
        },
      }
    );
    res.send("更新完成");
  }
});

//获取用户对某个食物的打分
app.get("/api/getuserdegree", async (req, res) => {
  //读取用户id
  var userid = req.headers["x-wx-openid"];
  //读取读取平均分的食物的id
  var food_degree_id = req.query.foodid;
  //根据该id获取所有打分记录
  var userdegree = await food_user_degree.findOne({
    attributes: ["user_degree"],
    where: {
      user_id: userid,
      food_id: food_degree_id,
    },
  });
  //如果用户从来没有打过分
  if (userdegree == null) {
    res.send("没有记录");
    //如果用户有打分记录
  } else {
    res.send(userdegree);
  }
});

//获取某个食物的平均评分
app.get("/api/getavgdegree", async (req, res) => {
  //读取读取平均分的食物的id
  var food_degree_id = req.query.foodid;
  //根据该id获取所有打分记录，并计算平均分
  var degree = await food_user_degree.findOne({
    attributes: [
      [Sequelize.fn("avg", Sequelize.col("user_degree")), "avg_degree"],
    ],
    where: {
      food_id: food_degree_id,
    },
    raw: true,
  });
  //更新foodlist数据库里食物的评分
  await foodlist.update(
    { food_degree: degree.avg_degree },
    {
      where: {
        id: food_degree_id,
      },
    }
  );
  res.send(degree);
});

//方便写入餐厅数据的接口
app.post("/dining_id", async (req, res) => {
  await store.creat({
    dining_name: req.query.diningname,
    address: req.query.diningaddress,
  });
  res.send("餐厅注册完成！");
});

//方便写入商铺数据的接口
app.post("/store_id", async (req, res) => {
  diningname = await diningroom.findOne({
    attributes: ["dining_name"],
    where: {
      id: req.query.diningid,
    },
  });
  await store.creat({
    store_name: req.query.storename,
    diningroom_id: req.query.diningid,
    dining_name: diningname,
  });
  res.send("商铺注册完成！");
});

//方便写入食物的接口

// 用于进行小程序登录的后端代码，待补充
app.get("https://api.weixin.qq.com/sns/jscode2session", async (req, res) => {});

//请求时间
app.get("/api/gettime", async (req, res) => {
  var update = sd.format(new Date(), "YYYY-MM-DD");
  res.send(update);
});

const port = process.env.PORT || 80;

async function bootstrap() {
  await initDB();
  app.listen(port, () => {
    console.log("启动成功", port);
  });
}

bootstrap();
